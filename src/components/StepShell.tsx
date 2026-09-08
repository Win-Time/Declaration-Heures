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
 *
 * La hauteur n'est animée qu'au changement d'étape. Quand c'est le contenu qui
 * s'anime (le calendrier qui se déplie), la carte le suit image par image :
 * deux transitions de hauteur imbriquées se poursuivaient l'une l'autre et
 * rendaient l'ouverture saccadée.
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
  const sizerRef = useRef<HTMLDivElement>(null);
  const [animateHeight, setAnimateHeight] = useState(false);

  useEffect(() => {
    const node = contentRef.current;
    const sizer = sizerRef.current;
    if (!node || !sizer) return;

    // La hauteur est écrite directement dans le DOM plutôt que passée par un
    // state : un aller-retour React coûtait une image, visible en début
    // d'ouverture du calendrier sous forme d'à-coup.
    const measure = () => {
      sizer.style.height = `${node.offsetHeight}px`;
    };
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [stepKey]);

  // Fenêtre d'animation ouverte le temps de la transition d'étape, puis
  // refermée : ensuite la carte colle au contenu sans latence.
  useEffect(() => {
    if (reduce) return;
    setAnimateHeight(true);
    const timer = window.setTimeout(
      () => setAnimateHeight(false),
      PAGE_DURATION * 1000 + 120,
    );
    return () => window.clearTimeout(timer);
  }, [stepKey, reduce]);

  const distance = reduce ? 0 : PAGE_SLIDE_DISTANCE * direction;
  const blur = reduce ? 0 : PAGE_BLUR;

  return (
    <div
      className="wt-card-sizer"
      ref={sizerRef}
      data-animate-height={animateHeight ? "true" : "false"}
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
