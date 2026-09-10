/**
 * Liste les propriétés Notion avec leur ID, prêtes à coller dans les variables
 * d'environnement.
 *
 *   node --env-file=.env.local scripts/notion-properties.mjs
 *   node --env-file=.env.local scripts/notion-properties.mjs 0612345678
 *
 * Le numéro est facultatif : sans lui, le script prend la première assistante
 * ayant au moins un contrat pour aller lire les propriétés d'une page Contrat.
 */
import { Client, isFullPage } from "@notionhq/client";

const token = process.env.NOTION_TOKEN;
if (!token) {
  console.error("NOTION_TOKEN manquant. Essaie : node --env-file=.env.local scripts/notion-properties.mjs");
  process.exit(1);
}

const notion = new Client({ auth: token });
const digits = (value) => String(value ?? "").replace(/[^0-9]/g, "");
const phoneKey = (value) => {
  const only = digits(value);
  return only.length < 9 ? only : only.slice(-9);
};

async function dataSourceId(databaseId) {
  const database = await notion.databases.retrieve({ database_id: databaseId });
  return database.data_sources?.[0]?.id ?? databaseId;
}

function printProperties(title, properties) {
  console.log(`\n── ${title} ──`);
  const rows = Object.entries(properties).map(([name, property]) => ({
    name,
    type: property.type,
    id: property.id,
  }));
  const width = Math.max(...rows.map((row) => row.name.length), 4);
  for (const row of rows) {
    console.log(`  ${row.name.padEnd(width)}  ${String(row.type).padEnd(12)}  id: ${row.id}`);
  }
  return rows;
}

/** Cherche une propriété par nom, casse/accents/espaces ignorés. */
function pick(rows, name) {
  const key = (value) =>
    value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  return rows.find((row) => key(row.name) === key(name));
}

const suggestions = [];
function suggest(envVar, row) {
  if (row) suggestions.push(`${envVar}=${row.id}`);
  else suggestions.push(`# ${envVar}= (propriété non trouvée — vérifie son nom)`);
}

const phone = process.argv[2];

// ── Base Assistantes ──
const assistantesSource = await dataSourceId(process.env.NOTION_DB_ASSISTANTES);
const assistantesSchema = await notion.dataSources.retrieve({ data_source_id: assistantesSource });
const assistantesRows = printProperties("Assistantes", assistantesSchema.properties);
suggest("NOTION_PROP_TELEPHONE", pick(assistantesRows, "Téléphone"));
suggest("NOTION_PROP_CONTRATS_CLIENTS", pick(assistantesRows, "Contrats Clients"));

// ── Base Déclarations ──
const declarationsSource = await dataSourceId(process.env.NOTION_DB_DECLARATIONS);
const declarationsSchema = await notion.dataSources.retrieve({ data_source_id: declarationsSource });
const declarationsRows = printProperties("Déclarations", declarationsSchema.properties);
suggest("NOTION_PROP_PERIODE", pick(declarationsRows, "Période de déclaration"));
suggest("NOTION_PROP_ASSISTANTE", pick(declarationsRows, "Assistante"));
suggest("NOTION_PROP_CONTRAT", pick(declarationsRows, "Contrat"));
suggest("NOTION_PROP_HEURES", pick(declarationsRows, "Heures à déclarer"));
suggest("NOTION_PROP_MINUTES", pick(declarationsRows, "Minutes déclarées"));

// ── Une page Contrat, atteinte comme le fait l'application ──
const contratsProperty = pick(assistantesRows, "Contrats Clients");
let contratRows = null;

if (contratsProperty) {
  let cursor;
  let assistante = null;
  do {
    const page = await notion.dataSources.query({
      data_source_id: assistantesSource,
      page_size: 100,
      start_cursor: cursor,
    });
    for (const result of page.results) {
      if (!isFullPage(result)) continue;
      const contrats = Object.values(result.properties).find(
        (property) => property.id === contratsProperty.id,
      );
      if (contrats?.type !== "relation" || contrats.relation.length === 0) continue;
      if (phone) {
        const stored = Object.values(result.properties).find(
          (property) => property.id === pick(assistantesRows, "Téléphone")?.id,
        );
        const text =
          stored?.type === "rich_text"
            ? stored.rich_text.map((item) => item.plain_text).join("")
            : stored?.type === "phone_number"
              ? (stored.phone_number ?? "")
              : "";
        if (phoneKey(text) !== phoneKey(phone)) continue;
      }
      assistante = result;
      break;
    }
    cursor = !assistante && page.has_more ? page.next_cursor : undefined;
  } while (cursor);

  if (assistante) {
    const contrats = Object.values(assistante.properties).find(
      (property) => property.id === contratsProperty.id,
    );
    const contratPage = await notion.pages.retrieve({ page_id: contrats.relation[0].id });
    contratRows = printProperties(
      `Contrat (page ${contratPage.id})`,
      contratPage.properties,
    );
    suggest("NOTION_PROP_CONTRAT_CLIENT", pick(contratRows, "Client"));
  }
}

if (!contratRows) {
  console.log("\n── Contrat ──\n  Aucune page de contrat atteignable (aucune assistante avec un contrat rattaché).");
  suggest("NOTION_PROP_CONTRAT_CLIENT", null);
}

console.log("\n── À coller dans les variables d'environnement ──\n");
console.log(suggestions.join("\n"));
console.log();
