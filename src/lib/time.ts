/**
 * Conversions et formatages de temps.
 *
 * Notion ne stocke que des minutes entières (`Total minutes`) ; l'affichage
 * humain en heures/minutes ne vit que côté UI.
 */

export const PARIS_TZ = "Europe/Paris";

/** heures + minutes -> minutes totales. */
export function toTotalMinutes(hours: number, minutes: number): number {
  return Math.round(hours) * 60 + Math.round(minutes);
}

/** 135 -> "2h15" ; 60 -> "1h" ; 45 -> "45min" ; 0 -> "0min". */
export function formatMinutes(total: number): string {
  const safe = Math.max(0, Math.round(total));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h${String(minutes).padStart(2, "0")}`;
}

/** Date du jour au format YYYY-MM-DD dans le fuseau donné. */
export function todayIso(timeZone: string = PARIS_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Bornes du mois calendaire contenant la date donnée, au format YYYY-MM-DD —
 * celui qu'attendent les filtres date de Notion.
 */
export function monthRangeOf(iso: string): { start: string; end: string } {
  const [year, month] = iso.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  return {
    start: `${year}-${mm}-01`,
    end: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

/** "2026-08-14" -> "août". */
export function monthNameFr(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day || 1)));
}

/**
 * « le mois de septembre », mais « le mois d'août » : les mois commençant par
 * une voyelle imposent l'élision.
 */
export function monthOfFr(iso: string): string {
  const name = monthNameFr(iso);
  return /^[aeiouâéèêîôû]/i.test(name) ? `d'${name}` : `de ${name}`;
}
