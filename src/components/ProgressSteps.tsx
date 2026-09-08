"use client";

import { motion, useReducedMotion } from "motion/react";

import { EASE_SMOOTH_OUT } from "@/lib/motion-tokens";

/** Barre de progression du parcours, dans le bandeau dégradé. */
export function ProgressSteps({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  const reduce = useReducedMotion();
  const ratio = Math.min(1, Math.max(0, current / total));

  return (
    <div className="wt-steps">
      <div className="wt-steps-track">
        <motion.div
          className="wt-steps-fill"
          initial={false}
          animate={{ width: `${ratio * 100}%` }}
          transition={
            reduce ? { duration: 0 } : { duration: 0.4, ease: EASE_SMOOTH_OUT }
          }
        />
      </div>
      <span className="wt-steps-label">
        {Math.min(current, total)}/{total}
      </span>
    </div>
  );
}
