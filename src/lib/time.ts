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
