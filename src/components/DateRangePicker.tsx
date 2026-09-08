"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import {
  type IsoDate,
  WEEKDAYS,
  formatRange,
  monthGrid,
  monthLabel,
  parseIso,
  shiftMonth,
} from "@/lib/calendar";
import { EASE_SMOOTH_OUT, SPRING_PRESS } from "@/lib/motion-tokens";
import { todayIso } from "@/lib/time";

/**
 * Sélecteur de période — un seul champ, calendrier maison (aucune UI native
 * d'OS, qui varie d'un téléphone à l'autre et ne sait pas afficher une plage).
 *
 * Premier clic : date de début. Survol : aperçu de la plage. Deuxième clic :
 * date de fin, et le panneau se referme. Un clic sur une date antérieure au
 * début redémarre la sélection depuis cette date.
 *
 * Le calendrier se déplie dans le flux plutôt qu'en surcouche : la carte anime
 * déjà sa hauteur (card resize), et un panneau flottant serait rogné par elle.
 *
 * Mouvement : dépliage repris de l'accordéon (transitions.dev n°21), retour
 * tactile `SPRING_PRESS` de starc007/ui-components.
 */
export function DateRangePicker({
  start,
  end,
  onChange,
  invalid,
}: {
  start: IsoDate | null;
  end: IsoDate | null;
  onChange: (range: { start: IsoDate | null; end: IsoDate | null }) => void;
  invalid?: boolean;
}) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<IsoDate | null>(null);
  const [view, setView] = useState(() => {
    const anchor = start ?? todayIso();
    const { year, month } = parseIso(anchor);
    return { year, month };
  });
  const rootRef = useRef<HTMLDivElement>(null);

  // Fermeture au clic extérieur et à Échap.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const picking = start !== null && end === null;
  // Pendant la sélection, la plage affichée suit le curseur.
  const previewEnd = picking ? (hovered ?? null) : end;
  const [rangeFrom, rangeTo] =
    start && previewEnd
      ? previewEnd < start
        ? [previewEnd, start]
        : [start, previewEnd]
      : [start, end];

  const select = (iso: IsoDate) => {
    if (!start || !picking) {
      onChange({ start: iso, end: null });
      setHovered(null);
      return;
    }
    if (iso < start) {
      // Un clic avant le début redémarre la plage à cette date.
      onChange({ start: iso, end: null });
      return;
    }
    onChange({ start, end: iso });
    setHovered(null);
    setOpen(false);
  };

  const cells = monthGrid(view.year, view.month);
  const label = formatRange(start, end);

  return (
    <div className="wt-range" ref={rootRef}>
      <span className="wt-field-label" id="wt-range-label">
        Période déclarée
      </span>

      <motion.button
        type="button"
        className={`wt-input wt-range-trigger${invalid ? " is-error" : ""}`}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby="wt-range-label"
        whileTap={reduce ? undefined : { scale: 0.99 }}
        transition={SPRING_PRESS}
      >
        <span className={label ? "" : "wt-range-placeholder"}>
          {label || "Choisis ta période"}
        </span>
        <CalendarGlyph />
      </motion.button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            className="wt-calendar"
            role="dialog"
            aria-label="Choisir la période"
            initial={
              reduce
                ? { opacity: 0, height: 0 }
                : { opacity: 0, height: 0, filter: "blur(2px)" }
            }
            animate={{ opacity: 1, height: "auto", filter: "blur(0px)" }}
            exit={
              reduce
                ? { opacity: 0, height: 0 }
                : { opacity: 0, height: 0, filter: "blur(2px)" }
            }
            transition={{
              duration: reduce ? 0 : 0.28,
              ease: EASE_SMOOTH_OUT,
            }}
          >
            <div className="wt-calendar-inner">
              <div className="wt-calendar-head">
                <button
                  type="button"
                  className="wt-calendar-nav"
                  onClick={() => setView(shiftMonth(view.year, view.month, -1))}
                  aria-label="Mois précédent"
                >
                  ‹
                </button>
                <span className="wt-calendar-month">
                  {monthLabel(view.year, view.month)}
                </span>
                <button
                  type="button"
                  className="wt-calendar-nav"
                  onClick={() => setView(shiftMonth(view.year, view.month, 1))}
                  aria-label="Mois suivant"
                >
                  ›
                </button>
              </div>

              <div className="wt-calendar-weekdays" aria-hidden="true">
                {WEEKDAYS.map((day, index) => (
                  <span key={`${day}-${index}`}>{day}</span>
                ))}
              </div>

              <div className="wt-calendar-grid" onMouseLeave={() => setHovered(null)}>
                {cells.map((iso, index) => {
                  if (!iso) {
                    return <span key={`empty-${index}`} className="wt-day-empty" />;
                  }
                  const isStart = iso === rangeFrom;
                  const isEnd = iso === rangeTo && rangeTo !== rangeFrom;
                  const inRange =
                    rangeFrom !== null &&
                    rangeTo !== null &&
                    iso > rangeFrom &&
                    iso < rangeTo;
                  const edge = isStart || isEnd;

                  return (
                    <button
                      key={iso}
                      type="button"
                      className={`wt-day${edge ? " is-edge" : ""}${inRange ? " is-in-range" : ""}${isStart ? " is-start" : ""}${isEnd ? " is-end" : ""}`}
                      onClick={() => select(iso)}
                      onMouseEnter={() => picking && setHovered(iso)}
                      onFocus={() => picking && setHovered(iso)}
                      aria-pressed={edge || inRange}
                    >
                      {parseIso(iso).day}
                    </button>
                  );
                })}
              </div>

              <p className="wt-calendar-hint">
                {picking
                  ? "Choisis maintenant la date de fin."
                  : "Clique sur la date de début, puis sur celle de fin."}
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function CalendarGlyph() {
  return (
    <svg
      className="wt-range-glyph"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="16" rx="4" strokeWidth="2" stroke="currentColor" />
      <path d="M3 10h18M8 3v4M16 3v4" strokeWidth="2" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}
