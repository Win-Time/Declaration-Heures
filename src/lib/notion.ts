import "server-only";

import { Client, isFullPage } from "@notionhq/client";
import type {
  PageObjectResponse,
  QueryDataSourceParameters,
} from "@notionhq/client";

import type { ClientOption } from "./notion-types";
import { phoneKey } from "./phone";
import { currentMonthRange } from "./time";

/**
 * Accès Notion — exclusivement côté serveur.
 *
 * Le SDK v5 ne connaît plus `databases.query` : une base expose une ou
 * plusieurs *data sources*, et c'est la data source que l'on interroge. Les
 * variables d'environnement restent des IDs de base ; on résout (et on met en
 * cache) la data source correspondante au premier appel.
 */

export type ForfaitInfo = {
  /** Forfait mensuel en heures, null si aucun contrat / forfait renseigné. */
  forfaitHours: number | null;
  /** Minutes déjà déclarées ce mois-ci pour ce couple assistante/client. */
  consumedMinutes: number;
};

const PHONE_PROPERTY = "Téléphone";
const ASSISTANTE_CLIENTS_PROPERTY = "Clients";
const CLIENT_CONTRAT_PROPERTY = "Contrat";
const CONTRAT_FORFAIT_PROPERTY = "Forfait (h)";
const DECLARATION_PERIODE_PROPERTY = "Période de déclaration";
const DECLARATION_ASSISTANTE_PROPERTY = "Assistante déclarante";
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

function numberOf(page: PageObjectResponse, name: string): number | null {
  const property = page.properties[name];
  if (property?.type === "number") return property.number;
  if (property?.type === "formula" && property.formula.type === "number") {
    return property.formula.number;
  }
  return null;
}

/**
 * IDs d'une relation. Au-delà de 25 éléments Notion tronque la valeur
 * embarquée dans la page : on repasse alors par l'endpoint dédié, paginé.
 */
async function relationIds(
  page: PageObjectResponse,
  name: string,
): Promise<string[]> {
  const property = page.properties[name];
  if (!property || property.type !== "relation") return [];

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
    (page) => phoneKey(richTextToPlain(page.properties[PHONE_PROPERTY])) === key,
  );

  if (matches.length === 0) return null;
  if (matches.length > 1) {
    console.warn(
      `[win-time] Téléphone en double dans la base Assistantes (${matches.length} occurrences, clé …${key.slice(-4)}). Première occurrence retenue : ${matches[0].id}`,
    );
  }
  return { id: matches[0].id };
}

/** Clients rattachés à une assistante — et rien d'autre. */
export async function listClientsForAssistante(
  assistanteId: string,
): Promise<ClientOption[]> {
  const assistante = await retrievePage(assistanteId);
  if (!assistante) return [];

  const ids = await relationIds(assistante, ASSISTANTE_CLIENTS_PROPERTY);
  const clients: ClientOption[] = [];

  // Résolution séquentielle : le throttle global garde les 3 req/s de Notion.
  for (const id of ids) {
    const page = await retrievePage(id);
    if (page) clients.push({ id: page.id, name: pageTitle(page) });
  }

  return clients.sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export async function createDeclaration(input: {
  assistanteId: string;
  clientId: string;
  clientName: string;
  start: string;
  end: string;
  totalMinutes: number;
}): Promise<string> {
  const databaseId = env("NOTION_DB_DECLARATIONS");
  const sourceId = await dataSourceId(databaseId);

  const properties: Record<string, unknown> = {
    [DECLARATION_PERIODE_PROPERTY]: {
      date: { start: input.start, end: input.end },
    },
    [DECLARATION_ASSISTANTE_PROPERTY]: {
      relation: [{ id: input.assistanteId }],
    },
    [DECLARATION_CLIENT_PROPERTY]: { relation: [{ id: input.clientId }] },
    [DECLARATION_MINUTES_PROPERTY]: { number: input.totalMinutes },
  };

  const titleProperty = await declarationTitleProperty(sourceId);
  if (titleProperty) {
    properties[titleProperty] = {
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

/** Nom de la propriété `title` de la base Déclarations (best effort). */
async function declarationTitleProperty(
  sourceId: string,
): Promise<string | null> {
  try {
    const source = await throttle(() =>
      client().dataSources.retrieve({ data_source_id: sourceId }),
    );
    if (!("properties" in source)) return null;
    for (const [name, property] of Object.entries(source.properties)) {
      if (property.type === "title") return name;
    }
  } catch {
    // Sans titre la page reste valide : on n'échoue pas la déclaration pour ça.
  }
  return null;
}

/**
 * Point sur la situation : forfait du client + minutes déjà déclarées sur le
 * mois calendaire en cours (fuseau Europe/Paris, sur la date de début de la
 * période déclarée).
 */
export async function getForfaitInfo(
  assistanteId: string,
  clientId: string,
): Promise<ForfaitInfo> {
  // Séquentiel : les appels passent de toute façon par la file de throttle.
  const forfaitHours = await readForfaitHours(clientId);
  const consumedMinutes = await sumMonthMinutes(assistanteId, clientId);
  return { forfaitHours, consumedMinutes };
}

async function readForfaitHours(clientId: string): Promise<number | null> {
  const clientPage = await retrievePage(clientId);
  if (!clientPage) return null;

  const contratIds = await relationIds(clientPage, CLIENT_CONTRAT_PROPERTY);
  for (const contratId of contratIds) {
    const contrat = await retrievePage(contratId);
    if (!contrat) continue;
    const forfait = numberOf(contrat, CONTRAT_FORFAIT_PROPERTY);
    if (typeof forfait === "number") return forfait;
  }
  return null;
}

async function sumMonthMinutes(
  assistanteId: string,
  clientId: string,
): Promise<number> {
  const month = currentMonthRange();
  const pages = await queryAll(env("NOTION_DB_DECLARATIONS"), {
    and: [
      {
        property: DECLARATION_ASSISTANTE_PROPERTY,
        relation: { contains: assistanteId },
      },
      { property: DECLARATION_CLIENT_PROPERTY, relation: { contains: clientId } },
      {
        property: DECLARATION_PERIODE_PROPERTY,
        date: { on_or_after: month.start },
      },
      {
        property: DECLARATION_PERIODE_PROPERTY,
        date: { on_or_before: month.end },
      },
    ],
  } as QueryDataSourceParameters["filter"]);

  return pages.reduce(
    (total, page) => total + (numberOf(page, DECLARATION_MINUTES_PROPERTY) ?? 0),
    0,
  );
}
