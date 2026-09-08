"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import {
  EASE_SMOOTH_OUT,
  STAGGER_BLUR,
  STAGGER_DISTANCE,
  STAGGER_DURATION,
  STAGGER_STEP,
} from "@/lib/motion-tokens";

/**
 * Apparition en cascade — texts reveal (transitions.dev n°18) : chaque bloc
 * monte de --stagger-distance, sort du flou et prend son tour après
 * --stagger-stagger.
 */
export function Reveal({
  index = 0,
  children,
  className,
}: {
  index?: number;
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{
        opacity: 0,
        y: STAGGER_DISTANCE,
        filter: `blur(${STAGGER_BLUR}px)`,
      }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{
        duration: STAGGER_DURATION,
        ease: EASE_SMOOTH_OUT,
        delay: index * STAGGER_STEP,
      }}
    >
      {children}
    </motion.div>
  );
}
