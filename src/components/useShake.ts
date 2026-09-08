"use client";

import { useEffect, useState } from "react";

/**
 * Error state shake (transitions.dev n°12).
 *
 * L'animation est armée à l'arrivée d'une erreur et désarmée à la fin du
 * keyframe : le champ n'est jamais remonté, la saisie et le curseur restent en
 * place.
 */
export function useShake(trigger: unknown): {
  shaking: boolean;
  onAnimationEnd: () => void;
} {
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    if (trigger) setShaking(true);
  }, [trigger]);

  return { shaking, onAnimationEnd: () => setShaking(false) };
}
