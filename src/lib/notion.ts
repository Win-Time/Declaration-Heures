import "server-only";

import { Client, isFullPage } from "@notionhq/client";
import type {
  PageObjectResponse,
  QueryDataSourceParameters,
} from "@notionhq/client";

import type { ClientOption } from "./notion-types";
import { phoneKey } from "./phone";

/**
 * Accès Notion — exclusivement côté serveur.
 *
 * Le SDK v5 ne connaît plus `databases.query` : une base expose une ou
 * plusieurs *data sources*, et c'est la data source que l'on interroge. Les
 * variables d'environnement restent des IDs de base ; on résout (et on met en
 * cache) la data source correspondante au premier appel.
 */

const PHONE_PROPERTY = "Téléphone";
/** Sur la page Assistante : ses contrats, pas ses clients directement. */
const ASSISTANTE_CONTRATS_PROPERTY = "Contrats Clients";
/** Sur une page Contrat : le client qu'il concerne. */
const CONTRAT_CLIENT_PROPERTY = "Client";
const DECLARATION_PERIODE_PROPERTY = "Période de déclaration";
const DECLARATION_ASSISTANTE_PROPERTY = "Assistante";
const DECLARATION_CONTRAT_PROPERTY = "Contrat";
const DECLARATION_CLIENT_PROPERTY = "Client";
const DECLARATION_MINUTES_PROPERTY = "Total minutes";

/** Notion tolère 3 requêtes/seconde : on sérialise avec un écart minimum. */
const MIN_REQUEST_GAP_MS = 350;

let notionClient: Client | null = null;
let requestChain: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

const dataSourceCache = new Map<string, string>();

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable d'environnement manquante : ${name}`);
  }
  return value;
}

function client(): Client {
  if (!notionClient) {
    notionClient = new Client({ auth: env("NOTION_TOKEN") });
  }
  return notionClient;
}

/**
 * File d'attente globale : chaque appel Notion attend que le précédent soit
 * terminé, puis respecte l'écart minimal. C'est ce qui tient lieu de garde-fou
 * contre le rate limit quand on résout plusieurs pages liées d'affilée.
 */
function throttle<T>(task: () => Promise<T>): Promise<T> {
  const run = requestChain.then(async () => {
    const wait = MIN_REQUEST_GAP_MS - (Date.now() - lastRequestAt);
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    lastRequestAt = Date.now();
    return task();
  });
  // La chaîne ne doit jamais se rompre sur une erreur : on la rattrape ici,
  // l'erreur reste propagée à l'appelant via `run`.
  requestChain = run.catch(() => undefined);
  return run;
}

/** ID de base -> ID de data source (mis en cache pour la durée du process). */
async function dataSourceId(databaseId: string): Promise<string> {
  const cached = dataSourceCache.get(databaseId);
  if (cached) return cached;

  try {
    const database = await throttle(() =>
      client().databases.retrieve({ database_id: databaseId }),
    );
    const sources = "data_sources" in database ? database.data_sources : [];
    const first = sources[0]?.id;
    if (first) {
      dataSourceCache.set(databaseId, first);
      return first;
    }
  } catch {
    // L'ID fourni est peut-être déjà celui d'une data source : on tente tel quel.
  }

  dataSourceCache.set(databaseId, databaseId);
  return databaseId;
}

/** Parcourt toutes les pages d'une data source (pagination incluse). */
async function queryAll(
  databaseId: string,
  filter?: QueryDataSourceParameters["filter"],
): Promise<PageObjectResponse[]> {
  const sourceId = await dataSourceId(databaseId);
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;

  do {
    const response = await throttle(() =>
      client().dataSources.query({
        data_source_id: sourceId,
        page_size: 100,
        start_cursor: cursor,
        ...(filter ? { filter } : {}),
      }),
    );
    for (const result of response.results) {
      if (isFullPage(result)) pages.push(result);
    }
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return pages;
}

async function retrievePage(pageId: string): Promise<PageObjectResponse | null> {
  const page = await throttle(() => client().pages.retrieve({ page_id: pageId }));
  return isFullPage(page) ? page : null;
}

/* ────────────────────────── lecture de propriétés ────────────────────────── */

/**
 * Clé de comparaison d'un nom de propriété : sans accents, sans casse, espaces
 * normalisés. Un « Client » saisi avec une majuscule différente ou une espace
 * finale dans Notion reste ainsi trouvable.
 */
function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Propriété d'une page, retrouvée par son nom exact puis par nom normalisé. */
function findProperty(
  page: PageObjectResponse,
  name: string,
): PageObjectResponse["properties"][string] | undefined {
  const exact = page.properties[name];
  if (exact) return exact;

  const target = normalizeKey(name);
  for (const [key, property] of Object.entries(page.properties)) {
    if (normalizeKey(key) === target) return property;
  }
  return undefined;
}

/** « Nom (title), Client (rollup) » — pour rendre les logs exploitables. */
function describeProperties(page: PageObjectResponse): string {
  return Object.entries(page.properties)
    .map(([name, property]) => `${name} (${property.type})`)
    .join(", ");
}

function richTextToPlain(
  property: PageObjectResponse["properties"][string] | undefined,
): string {
  if (!property) return "";
  if (property.type === "rich_text") {
    return property.rich_text.map((item) => item.plain_text).join("");
  }
  if (property.type === "title") {
    return property.title.map((item) => item.plain_text).join("");
  }
  if (property.type === "phone_number") {
    return property.phone_number ?? "";
  }
  return "";
}

/** Titre d'une page, quel que soit le nom de sa propriété `title`. */
function pageTitle(page: PageObjectResponse): string {
  for (const property of Object.values(page.properties)) {
    if (property.type === "title") {
      const text = property.title.map((item) => item.plain_text).join("").trim();
      if (text) return text;
    }
  }
  return "Client sans nom";
}


/**
 * IDs d'une relation. Au-delà de 25 éléments Notion tronque la valeur
 * embarquée dans la page : on repasse alors par l'endpoint dédié, paginé.
 */
async function relationIds(
  page: PageObjectResponse,
  name: string,
): Promise<string[]> {
  const property = findProperty(page, name);
  if (!property) return [];

  // Une propriété qui affiche des pages liées n'est pas toujours une relation :
  // ce peut être un rollup qui remonte la relation d'une autre base.
  if (property.type === "rollup") {
    if (property.rollup.type !== "array") return [];
    return property.rollup.array.flatMap((item) =>
      item.type === "relation" ? item.relation.map((page) => page.id) : [],
    );
  }

  if (property.type !== "relation") return [];

  const ids = property.relation.map((item) => item.id);
  // Notion tronque la relation embarquée au-delà de 25 éléments et signale la
  // troncature par `has_more` — un champ que le typage du SDK n'expose pas.
  const truncated = (property as { has_more?: boolean }).has_more === true;
  if (!truncated) return ids;

  const complete: string[] = [];
  let cursor: string | undefined;
  do {
    const response = await throttle(() =>
      client().pages.properties.retrieve({
        page_id: page.id,
        property_id: property.id,
        page_size: 100,
        start_cursor: cursor,
      }),
    );
    if (response.object !== "list") break;
    for (const item of response.results) {
      if (item.type === "relation") complete.push(item.relation.id);
    }
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return complete.length > 0 ? complete : ids;
}

/* ─────────────────────────────── requêtes ──────────────────────────────── */

/**
 * Identifie une assistante par son téléphone.
 *
 * Notion ne sait pas filtrer sur une valeur normalisée (« 06 12 34 56 78 » ne
 * contient pas « 612345678 »), donc on parcourt la base et on compare des clés
 * normalisées des deux côtés. La base des assistantes est petite : c'est une
 * poignée de requêtes au pire.
 */
export async function findAssistanteByPhone(
  phone: string,
): Promise<{ id: string } | null> {
  const key = phoneKey(phone);
  if (!key) return null;

  const pages = await queryAll(env("NOTION_DB_ASSISTANTES"));
  const matches = pages.filter(
    (page) => phoneKey(richTextToPlain(findProperty(page, PHONE_PROPERTY))) === key,
  );

  if (matches.length === 0) return null;
  if (matches.length > 1) {
    console.warn(
      `[win-time] Téléphone en double dans la base Assistantes (${matches.length} occurrences, clé …${key.slice(-4)}). Première occurrence retenue : ${matches[0].id}`,
    );
  }
  return { id: matches[0].id };
}

/**
 * Clients rattachés à une assistante — et rien d'autre.
 *
 * Le lien passe par les contrats : page Assistante → relation
 * « Contrats Clients » → pour chaque contrat, sa relation « Client ». Chaque
 * option retenue garde l'ID du contrat dont elle vient, car la déclaration
 * doit référencer les deux.
 */
export async function listClientsForAssistante(
  assistanteId: string,
): Promise<ClientOption[]> {
  const assistante = await retrievePage(assistanteId);
  if (!assistante) return [];

  const contratIds = await relationIds(assistante, ASSISTANTE_CONTRATS_PROPERTY);
  const clients: ClientOption[] = [];
  const seen = new Set<string>();

  // Résolution séquentielle : le throttle global garde les 3 req/s de Notion.
  for (const contratId of contratIds) {
    const contrat = await retrievePage(contratId);
    if (!contrat) continue;

    const clientIds = await relationIds(contrat, CONTRAT_CLIENT_PROPERTY);
    if (clientIds.length === 0) {
      // Le détail des propriétés évite d'avoir à deviner : il nomme ce que la
      // page expose réellement et sous quel type.
      console.warn(
        `[win-time] Contrat ${contratId} ignoré : rien à lire dans « ${CONTRAT_CLIENT_PROPERTY} ». Propriétés de la page : ${describeProperties(contrat)}`,
      );
      continue;
    }

    for (const clientId of clientIds) {
      if (seen.has(clientId)) {
        // Deux contrats pour le même client : on garde le premier, sinon la
        // liste afficherait deux lignes rigoureusement identiques.
        console.warn(
          `[win-time] Client ${clientId} rattaché à plusieurs contrats de l'assistante ${assistanteId}. Contrat retenu : ${clients.find((option) => option.id === clientId)?.contratId}`,
        );
        continue;
      }

      const clientPage = await retrievePage(clientId);
      if (!clientPage) continue;

      seen.add(clientId);
      clients.push({
        id: clientPage.id,
        name: pageTitle(clientPage),
        contratId: contrat.id,
      });
    }
  }

  return clients.sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export async function createDeclaration(input: {
  assistanteId: string;
  clientId: string;
  clientName: string;
  contratId: string;
  start: string;
  end: string;
  totalMinutes: number;
}): Promise<string> {
  const databaseId = env("NOTION_DB_DECLARATIONS");
  const sourceId = await dataSourceId(databaseId);
  const schema = await declarationSchema(sourceId);

  const properties: Record<string, unknown> = {};
  const missing: string[] = [];
  const mistyped: string[] = [];

  /**
   * Écrit une propriété sous son nom réel dans Notion.
   *
   * À l'écriture, contrairement à la lecture, Notion exige le nom exact : on
   * résout donc chaque propriété contre le schéma de la base, en tolérant les
   * écarts de casse, d'accent et d'espaces.
   */
  const put = (name: string, expectedType: string, value: unknown) => {
    const found = schema.resolve(name);
    if (!found) {
      missing.push(name);
      return;
    }
    if (found.type !== expectedType) {
      mistyped.push(`« ${found.name} » est de type ${found.type}, attendu ${expectedType}`);
      return;
    }
    properties[found.name] = value;
  };

  put(DECLARATION_PERIODE_PROPERTY, "date", {
    date: { start: input.start, end: input.end },
  });
  put(DECLARATION_ASSISTANTE_PROPERTY, "relation", {
    relation: [{ id: input.assistanteId }],
  });
  put(DECLARATION_CONTRAT_PROPERTY, "relation", {
    relation: [{ id: input.contratId }],
  });
  put(DECLARATION_CLIENT_PROPERTY, "relation", {
    relation: [{ id: input.clientId }],
  });
  put(DECLARATION_MINUTES_PROPERTY, "number", { number: input.totalMinutes });

  if (missing.length > 0 || mistyped.length > 0) {
    throw new NotionSchemaError(
      [
        missing.length > 0
          ? `Propriétés introuvables dans la base Déclarations : ${missing.map((name) => `« ${name} »`).join(", ")}.`
          : null,
        mistyped.length > 0 ? mistyped.join(" ; ") + "." : null,
        `Propriétés de la base : ${schema.describe()}`,
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  if (schema.titleName) {
    properties[schema.titleName] = {
      title: [
        {
          text: { content: `${input.clientName} — ${input.start} → ${input.end}` },
        },
      ],
    };
  }

  const page = await throttle(() =>
    client().pages.create({
      parent: { data_source_id: sourceId },
      properties: properties as Parameters<
        Client["pages"]["create"]
      >[0]["properties"],
    }),
  );

  return page.id;
}

/**
 * Erreur de configuration Notion : la base ne correspond pas à ce que le
 * formulaire écrit. Réessayer n'y changera rien, il faut corriger le schéma.
 */
export class NotionSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotionSchemaError";
  }
}

type DeclarationSchema = {
  /** Nom de la propriété `title`, quel qu'il soit. */
  titleName: string | null;
  /** Nom et type réels d'une propriété, à partir d'un nom approchant. */
  resolve: (name: string) => { name: string; type: string } | null;
  /** « Nom (title), Minutes (number) » — pour les messages d'erreur. */
  describe: () => string;
};

const schemaCache = new Map<string, DeclarationSchema>();

/** Schéma de la base Déclarations, lu une fois puis mis en cache. */
async function declarationSchema(sourceId: string): Promise<DeclarationSchema> {
  const cached = schemaCache.get(sourceId);
  if (cached) return cached;

  const source = await throttle(() =>
    client().dataSources.retrieve({ data_source_id: sourceId }),
  );
  if (!("properties" in source)) {
    throw new NotionSchemaError(
      "Le schéma de la base Déclarations est illisible avec ce token.",
    );
  }

  const entries = Object.entries(source.properties).map(([name, property]) => ({
    name,
    type: property.type as string,
  }));
  const byKey = new Map(entries.map((entry) => [normalizeKey(entry.name), entry]));

  const schema: DeclarationSchema = {
    titleName: entries.find((entry) => entry.type === "title")?.name ?? null,
    resolve: (name) =>
      source.properties[name]
        ? { name, type: source.properties[name].type as string }
        : (byKey.get(normalizeKey(name)) ?? null),
    describe: () =>
      entries.map((entry) => `${entry.name} (${entry.type})`).join(", "),
  };

  schemaCache.set(sourceId, schema);
  return schema;
}
