"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import { SPRING_PRESS } from "@/lib/motion-tokens";

/**
 * Bouton pill en dégradé (charte) avec le retour tactile de
 * starc007/ui-components (SPRING_PRESS sur `whileTap`).
 */
export function PressableButton({
  children,
  onClick,
  disabled,
  type = "button",
  variant = "solid",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  variant?: "solid" | "ghost";
}) {
  const reduce = useReducedMotion();

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={variant === "ghost" ? "wt-btn wt-btn-ghost" : "wt-btn"}
      whileTap={reduce || disabled ? undefined : { scale: 0.97 }}
      transition={SPRING_PRESS}
    >
      {children}
    </motion.button>
  );
}
