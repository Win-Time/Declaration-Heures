/**
 * Identification des propriétés Notion.
 *
 * Une propriété se désigne par son ID, insensible aux renommages, ou à défaut
 * par son nom (ou l'un de ses alias). Les IDs viennent de variables
 * d'environnement : ce sont des valeurs propres à chaque workspace, que
 * `npm run notion:props` liste.
 */
export type PropertyRef = {
  /** Nom lisible : repli de résolution, et libellé des messages d'erreur. */
  name: string;
  /** Autres noms acceptés, quand l'intitulé exact n'est pas certain. */
  aliases?: readonly string[];
  /** ID Notion, s'il a été renseigné. */
  id?: string;
  /** Variable d'environnement qui porte l'ID. */
  envVar: string;
};

function ref(
  envVar: string,
  name: string,
  aliases?: readonly string[],
): PropertyRef {
  const id = process.env[envVar]?.trim();
  return { name, aliases, envVar, id: id || undefined };
}

/** Propriétés lues sur la page d'une assistante. */
export const ASSISTANTE_PROPS = {
  // Type `phone_number` dans la base Assistantes.
  telephone: ref("NOTION_PROP_TELEPHONE", "Téléphone"),
  contrats: ref("NOTION_PROP_CONTRATS_CLIENTS", "Contrats Clients", [
    "Contrats",
  ]),
} as const;

/** Propriété lue sur la page d'un contrat. */
export const CONTRAT_PROPS = {
  client: ref("NOTION_PROP_CONTRAT_CLIENT", "Client", ["Clients"]),
} as const;

/**
 * Propriétés écrites sur une déclaration, avec le type Notion attendu.
 *
 * `Client` n'y figure pas : dans la base « Heures déclarées », c'est un rollup
 * calculé à partir de la relation `Contrat`. Il est en lecture seule, Notion
 * refuse toute écriture dessus — et il se remplit tout seul.
 *
 * Le temps est écrit sur deux nombres, selon la convention des déclarations
 * déjà saisies : `Minutes déclarées` porte le **total** de minutes, et
 * `Heures à déclarer ` le nombre d'heures pleines (8 h 30 → 8 et 510).
 */
export const DECLARATION_PROPS = {
  periode: {
    ...ref("NOTION_PROP_PERIODE", "Période de déclaration"),
    type: "date",
  },
  assistante: {
    ...ref("NOTION_PROP_ASSISTANTE", "Assistante"),
    type: "relation",
  },
  contrat: { ...ref("NOTION_PROP_CONTRAT", "Contrat"), type: "relation" },
  /** Heures pleines. Le nom porte une espace finale dans Notion. */
  heures: {
    ...ref("NOTION_PROP_HEURES", "Heures à déclarer", ["Heures à déclarer "]),
    type: "number",
  },
  /** Total de minutes, et non les minutes restantes. */
  minutes: {
    ...ref("NOTION_PROP_MINUTES", "Minutes déclarées"),
    type: "number",
  },
} as const;

/** « Total minutes » ou « Total minutes (id abc123) » selon ce qui est connu. */
export function describeRef(reference: PropertyRef): string {
  return reference.id
    ? `« ${reference.name} » (id ${reference.id})`
    : `« ${reference.name} »`;
}

/** Noms acceptés pour une référence, dans l'ordre d'essai. */
export function refNames(reference: PropertyRef): readonly string[] {
  return [reference.name, ...(reference.aliases ?? [])];
}
