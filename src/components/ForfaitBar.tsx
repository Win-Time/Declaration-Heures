"use client";

import { motion, useReducedMotion } from "motion/react";

import { EASE_SMOOTH_OUT } from "@/lib/motion-tokens";
import { formatMinutes } from "@/lib/time";

/**
 * Barre de consommation du forfait mensuel.
 *
 * Remplissage animé au dégradé signature ; au-delà du forfait la barre est
 * pleine et bascule sur le rouge chrono.
 */
export function ForfaitBar({
  consumedMinutes,
  forfaitMinutes,
}: {
  consumedMinutes: number;
  forfaitMinutes: number;
}) {
  const reduce = useReducedMotion();
  const ratio = forfaitMinutes > 0 ? consumedMinutes / forfaitMinutes : 0;
  const over = consumedMinutes > forfaitMinutes;
  const width = `${Math.min(100, Math.max(0, ratio * 100))}%`;

  return (
    <div className="wt-forfait">
      <div
        className="wt-forfait-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={forfaitMinutes}
        aria-valuenow={Math.min(consumedMinutes, forfaitMinutes)}
        aria-valuetext={`${formatMinutes(consumedMinutes)} sur ${formatMinutes(forfaitMinutes)}`}
      >
        <motion.div
          className={over ? "wt-forfait-fill is-over" : "wt-forfait-fill"}
          initial={{ width: 0 }}
          animate={{ width }}
          transition={
            reduce
              ? { duration: 0 }
              : { duration: 0.9, delay: 0.15, ease: EASE_SMOOTH_OUT }
          }
        />
      </div>
      <div className="wt-forfait-legend">
        <span>{formatMinutes(consumedMinutes)} déclarées</span>
        <span>forfait {formatMinutes(forfaitMinutes)}</span>
      </div>
    </div>
  );
}
