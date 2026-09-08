/**
 * Tokens de mouvement partagés entre le CSS et les composants animés.
 *
 * Les courbes viennent des deux repos de référence : `EASE_SMOOTH_OUT` est
 * l'easing de transitions.dev (`--ease-smooth-out`), `EASE_OUT` et les ressorts
 * sont ceux de starc007/ui-components (`lib/ease.ts`).
 */

export const EASE_SMOOTH_OUT = [0.22, 1, 0.36, 1] as const;
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** Retour tactile sur les surfaces cliquables. */
export const SPRING_PRESS = {
  type: "spring",
  stiffness: 500,
  damping: 30,
  mass: 0.6,
} as const;

/** Transition d'étape — page side-by-side (transitions.dev n°8). */
export const PAGE_SLIDE_DISTANCE = 8;
export const PAGE_BLUR = 3;
export const PAGE_DURATION = 0.25;

/** Apparition en cascade — texts reveal (transitions.dev n°18). */
export const STAGGER_DISTANCE = 12;
export const STAGGER_BLUR = 3;
export const STAGGER_DURATION = 0.5;
export const STAGGER_STEP = 0.04;
