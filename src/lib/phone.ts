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
