/** Utilitaires de calendrier, en dates ISO "YYYY-MM-DD" (pas d'objets Date). */

export type IsoDate = string;

const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** Semaine française : lundi en premier. */
export const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

export function toIso(year: number, month: number, day: number): IsoDate {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseIso(iso: IsoDate): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

export function monthLabel(year: number, month: number): string {
  return `${MONTHS[month - 1]} ${year}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Index (0 = lundi) du premier jour du mois. */
export function firstWeekdayIndex(year: number, month: number): number {
  const sunday0 = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return (sunday0 + 6) % 7;
}

export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** Grille du mois : les cases vides du début sont des `null`. */
export function monthGrid(year: number, month: number): (IsoDate | null)[] {
  const cells: (IsoDate | null)[] = Array.from(
    { length: firstWeekdayIndex(year, month) },
    () => null,
  );
  for (let day = 1; day <= daysInMonth(year, month); day += 1) {
    cells.push(toIso(year, month, day));
  }
  return cells;
}

/** "2026-09-08" -> "8 sept." ; avec l'année si `withYear`. */
export function formatDayShort(iso: IsoDate, withYear = false): string {
  const { year, month, day } = parseIso(iso);
  const label = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
  return withYear ? `${label} ${year}` : label;
}

/** Libellé du champ : "8 sept. → 12 sept. 2026", ou une seule date. */
export function formatRange(start: IsoDate | null, end: IsoDate | null): string {
  if (!start) return "";
  if (!end || end === start) return formatDayShort(start, true);
  const sameYear = parseIso(start).year === parseIso(end).year;
  return `${formatDayShort(start, !sameYear)} → ${formatDayShort(end, true)}`;
}
