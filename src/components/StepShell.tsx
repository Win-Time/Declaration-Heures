"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import {
  EASE_SMOOTH_OUT,
  PAGE_BLUR,
  PAGE_DURATION,
  PAGE_SLIDE_DISTANCE,
} from "@/lib/motion-tokens";

/**
 * Enveloppe animée des étapes.
 *
 * - Transition d'écran : page side-by-side (transitions.dev n°8) — l'étape
 *   sortante glisse du côté d'où l'on vient, l'entrante arrive de l'autre,
 *   avec fondu + flou. Aucun changement d'écran n'est sec.
 * - Hauteur de la carte : card resize (transitions.dev n°1) — la carte suit la
 *   hauteur de l'étape affichée au lieu de sauter.
 */
export function StepShell({
  stepKey,
  direction,
  children,
}: {
  stepKey: string;
  direction: 1 | -1;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");

  useEffect(() => {
    const node = contentRef.current;
    if (!node) return;

    const measure = () => setHeight(node.offsetHeight);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [stepKey]);

  const distance = reduce ? 0 : PAGE_SLIDE_DISTANCE * direction;
  const blur = reduce ? 0 : PAGE_BLUR;

  return (
    <div
      className="wt-card-sizer"
      style={{ height: height === "auto" ? undefined : height }}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={stepKey}
          ref={contentRef}
          initial={{ opacity: 0, x: distance, filter: `blur(${blur}px)` }}
          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
          exit={{
            opacity: 0,
            x: -distance,
            filter: `blur(${blur}px)`,
            transition: { duration: reduce ? 0 : PAGE_DURATION * 0.6 },
          }}
          transition={{
            duration: reduce ? 0 : PAGE_DURATION,
            ease: EASE_SMOOTH_OUT,
          }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
