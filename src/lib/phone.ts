/**
 * Normalisation des numéros de téléphone.
 *
 * Le même traitement est appliqué à la saisie de l'assistante et à la valeur
 * stockée dans Notion : on ne compare jamais deux chaînes brutes.
 */

/** Ne garde que les chiffres : "+33 6 12.34-56 78" -> "33612345678". */
export function digitsOnly(input: string): string {
  return input.replace(/[^0-9]/g, "");
}

/**
 * Clé de comparaison d'un numéro français : les 9 derniers chiffres.
 *
 * C'est ce qui rend "+33612345678", "0033612345678" et "06 12 34 56 78"
 * équivalents — tous se terminent par "612345678".
 */
export function phoneKey(input: string): string {
  const digits = digitsOnly(input);
  if (digits.length < 9) return digits;
  return digits.slice(-9);
}

/** Un numéro exploitable a au moins 9 chiffres une fois nettoyé. */
export function isPlausiblePhone(input: string): boolean {
  return digitsOnly(input).length >= 9;
}

/**
 * Mise en forme d'affichage : les chiffres sont groupés par deux.
 * "064626262610" -> "06 46 26 26 10". Un préfixe international est conservé
 * tel quel devant les groupes ("+33 6 12 34 56 78" reste lisible).
 */
export function formatPhone(input: string): string {
  const international = input.trimStart().startsWith("+");
  const digits = digitsOnly(input).slice(0, 15);
  if (digits === "") return international ? "+" : "";

  if (international && digits.startsWith("33")) {
    const rest = digits.slice(2);
    const head = rest.slice(0, 1);
    const tail = rest.slice(1).match(/\d{1,2}/g) ?? [];
    return `+33${head ? ` ${head}` : ""}${tail.length ? ` ${tail.join(" ")}` : ""}`;
  }

  const groups = digits.match(/\d{1,2}/g) ?? [];
  return `${international ? "+" : ""}${groups.join(" ")}`;
}

/**
 * Position du curseur après reformatage : on la recale sur le même nombre de
 * chiffres saisis, sinon chaque espace inséré renvoie le curseur à la fin.
 */
export function caretAfterFormat(formatted: string, digitsBeforeCaret: number): number {
  if (digitsBeforeCaret <= 0) return 0;
  let seen = 0;
  for (let index = 0; index < formatted.length; index += 1) {
    if (/\d/.test(formatted[index])) {
      seen += 1;
      if (seen === digitsBeforeCaret) return index + 1;
    }
  }
  return formatted.length;
}
