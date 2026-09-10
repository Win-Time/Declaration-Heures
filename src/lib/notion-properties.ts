/**
 * Identification des propriétés Notion.
 *
 * Une propriété se désigne par son ID, insensible aux renommages, ou à défaut
 * par son nom. Les IDs viennent de variables d'environnement : ce sont des
 * valeurs propres à chaque workspace, `npm run notion:props` les liste.
 *
 * Sans ID configuré, on retombe sur le nom (avec tolérance de casse, d'accents
 * et d'espaces) : le formulaire fonctionne donc sans configuration, mais un
 * renommage dans Notion le casse à nouveau — c'est précisément ce que les IDs
 * évitent.
 */
export type PropertyRef = {
  /** Nom lisible : repli de résolution, et libellé des messages d'erreur. */
  name: string;
  /** ID Notion, s'il a été renseigné. */
  id?: string;
  /** Variable d'environnement qui porte l'ID. */
  envVar: string;
};

function ref(envVar: string, name: string): PropertyRef {
  const id = process.env[envVar]?.trim();
  return { name, envVar, id: id || undefined };
}

/** Propriétés lues sur la page d'une assistante. */
export const ASSISTANTE_PROPS = {
  telephone: ref("NOTION_PROP_TELEPHONE", "Téléphone"),
  contrats: ref("NOTION_PROP_CONTRATS_CLIENTS", "Contrats Clients"),
} as const;

/** Propriété lue sur la page d'un contrat. */
export const CONTRAT_PROPS = {
  client: ref("NOTION_PROP_CONTRAT_CLIENT", "Client"),
} as const;

/** Propriétés écrites sur une déclaration, avec le type Notion attendu. */
export const DECLARATION_PROPS = {
  periode: { ...ref("NOTION_PROP_PERIODE", "Période de déclaration"), type: "date" },
  assistante: { ...ref("NOTION_PROP_ASSISTANTE", "Assistante"), type: "relation" },
  contrat: { ...ref("NOTION_PROP_CONTRAT", "Contrat"), type: "relation" },
  client: { ...ref("NOTION_PROP_CLIENT", "Client"), type: "relation" },
  minutes: { ...ref("NOTION_PROP_MINUTES", "Minutes déclarées"), type: "number" },
} as const;

/** « Total minutes » ou « Total minutes (id abc123) » selon ce qui est connu. */
export function describeRef(reference: PropertyRef): string {
  return reference.id
    ? `« ${reference.name} » (id ${reference.id})`
    : `« ${reference.name} »`;
}
