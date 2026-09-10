import "server-only";

import { Client, isFullPage } from "@notionhq/client";
import type {
  PageObjectResponse,
  QueryDataSourceParameters,
} from "@notionhq/client";

import type { ClientOption } from "./notion-types";
import {
  ASSISTANTE_PROPS,
  CONTRAT_PROPS,
  DECLARATION_PROPS,
  type PropertyRef,
  describeRef,
} from "./notion-properties";
import { digitsOnly, phoneKey } from "./phone";

/**
 * Accès Notion — exclusivement côté serveur.
 *
 * Le SDK v5 ne connaît plus `databases.query` : une base expose une ou
 * plusieurs *data sources*, et c'est la data source que l'on interroge. Les
 * variables d'environnement restent des IDs de base ; on résout (et on met en
 * cache) la data source correspondante au premier appel.
 */


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

/**
 * Propriété d'une page, retrouvée d'abord par ID — insensible aux renommages —
 * puis par nom exact, puis par nom normalisé.
 */
function findProperty(
  page: PageObjectResponse,
  reference: PropertyRef,
): PageObjectResponse["properties"][string] | undefined {
  if (reference.id) {
    for (const property of Object.values(page.properties)) {
      if (property.id === reference.id) return property;
    }
  }

  const exact = page.properties[reference.name];
  if (exact) return exact;

  const target = normalizeKey(reference.name);
  for (const [key, property] of Object.entries(page.properties)) {
    if (normalizeKey(key) === target) return property;
  }
  return undefined;
}

/** « Client (relation, id abc123) » — pour rendre les logs exploitables. */
function describeProperties(page: PageObjectResponse): string {
  return Object.entries(page.properties)
    .map(([name, property]) => `${name} (${property.type}, id ${property.id})`)
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
  reference: PropertyRef,
): Promise<string[]> {
  const property = findProperty(page, reference);
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
    (page) =>
      phoneKey(richTextToPlain(findProperty(page, ASSISTANTE_PROPS.telephone))) ===
      key,
  );

  if (matches.length === 0) {
    // Si aucune page n'expose de téléphone lisible, ce n'est pas que le numéro
    // est inconnu : c'est la propriété qui n'est pas trouvée.
    const readable = pages.filter(
      (page) => digitsOnly(richTextToPlain(findProperty(page, ASSISTANTE_PROPS.telephone))).length > 0,
    );
    if (pages.length > 0 && readable.length === 0) {
      console.warn(
        `[win-time] Aucune assistante n'expose de téléphone lisible via ${describeRef(ASSISTANTE_PROPS.telephone)}. Propriétés de la première page : ${describeProperties(pages[0])}`,
      );
    }
    return null;
  }
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

  const contratIds = await relationIds(assistante, ASSISTANTE_PROPS.contrats);
  const clients: ClientOption[] = [];
  const seen = new Set<string>();

  // Résolution séquentielle : le throttle global garde les 3 req/s de Notion.
  for (const contratId of contratIds) {
    const contrat = await retrievePage(contratId);
    if (!contrat) continue;

    const clientIds = await relationIds(contrat, CONTRAT_PROPS.client);
    if (clientIds.length === 0) {
      // Le détail des propriétés évite d'avoir à deviner : il nomme ce que la
      // page expose réellement et sous quel type.
      console.warn(
        `[win-time] Contrat ${contratId} ignoré : rien à lire dans ${describeRef(CONTRAT_PROPS.client)}. Propriétés de la page : ${describeProperties(contrat)}`,
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
  contratId: string;
  start: string;
  end: string;
  /** Nom du client, qui sert de titre à la déclaration. */
  clientName: string;
  /** Temps déclaré, en minutes. */
  totalMinutes: number;
}): Promise<string> {
  const databaseId = env("NOTION_DB_DECLARATIONS");
  const sourceId = await dataSourceId(databaseId);
  const schema = await declarationSchema(sourceId);

  const properties: Record<string, unknown> = {};
  const missing: string[] = [];
  const mistyped: string[] = [];

  /**
   * Écrit une propriété en la désignant par son ID.
   *
   * Notion accepte comme clé du payload le nom ou l'ID de la propriété. On
   * utilise l'ID : c'est la seule désignation qui survit à un renommage.
   */
  const put = (
    reference: PropertyRef & { type: string },
    value: unknown,
  ) => {
    const found = schema.resolve(reference);
    if (!found) {
      missing.push(describeRef(reference));
      return;
    }
    if (found.type !== reference.type) {
      mistyped.push(
        `« ${found.name} » est de type ${found.type}, attendu ${reference.type}`,
      );
      return;
    }
    properties[found.id] = value;
  };

  put(DECLARATION_PROPS.periode, {
    date: { start: input.start, end: input.end },
  });
  put(DECLARATION_PROPS.assistante, {
    relation: [{ id: input.assistanteId }],
  });
  put(DECLARATION_PROPS.contrat, { relation: [{ id: input.contratId }] });
  // Convention des déclarations existantes : le total de minutes d'un côté,
  // les heures pleines de l'autre (8 h 30 → 8 et 510).
  put(DECLARATION_PROPS.heures, {
    number: Math.floor(input.totalMinutes / 60),
  });
  put(DECLARATION_PROPS.minutes, { number: input.totalMinutes });

  if (missing.length > 0 || mistyped.length > 0) {
    throw new NotionSchemaError(
      [
        missing.length > 0
          ? `Propriétés introuvables dans la base Déclarations : ${missing.join(", ")}.`
          : null,
        mistyped.length > 0 ? `${mistyped.join(" ; ")}.` : null,
        `Propriétés de la base : ${schema.describe()}`,
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  if (schema.titleId) {
    // Le titre de la base « Heures déclarées » porte le nom du client.
    properties[schema.titleId] = {
      title: [{ text: { content: input.clientName } }],
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

type SchemaEntry = { id: string; name: string; type: string };

type DeclarationSchema = {
  /** ID de la propriété `title`, quel que soit son nom. */
  titleId: string | null;
  /** Propriété réelle correspondant à une référence (ID d'abord, puis nom). */
  resolve: (reference: PropertyRef) => SchemaEntry | null;
  /** « Nom (title, id title) » — pour les messages d'erreur. */
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

  const entries: SchemaEntry[] = Object.entries(source.properties).map(
    ([name, property]) => ({
      id: property.id as string,
      name,
      type: property.type as string,
    }),
  );
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const byExactName = new Map(entries.map((entry) => [entry.name, entry]));
  const byKey = new Map(entries.map((entry) => [normalizeKey(entry.name), entry]));

  const schema: DeclarationSchema = {
    titleId: entries.find((entry) => entry.type === "title")?.id ?? null,
    resolve: (reference) =>
      (reference.id ? byId.get(reference.id) : undefined) ??
      byExactName.get(reference.name) ??
      byKey.get(normalizeKey(reference.name)) ??
      null,
    describe: () =>
      entries
        .map((entry) => `${entry.name} (${entry.type}, id ${entry.id})`)
        .join(", "),
  };

  schemaCache.set(sourceId, schema);
  return schema;
}
