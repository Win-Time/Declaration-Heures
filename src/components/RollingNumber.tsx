"use client";

import { motion, useReducedMotion } from "motion/react";

import { EASE_OUT } from "@/lib/motion-tokens";

const DIGIT_HEIGHT_EM = 1.1;
const DIGITS = Array.from({ length: 10 }, (_, n) => n);

/**
 * Compteur à colonnes de chiffres, adapté du `number-ticker` de
 * starc007/ui-components : chaque chiffre roule vers sa valeur, les caractères
 * non numériques (h, min, espaces) restent fixes.
 */
export function RollingNumber({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const chars = text.split("");

  if (reduce) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={`wt-digits ${className ?? ""}`.trim()}>
      <span className="wt-visually-hidden">{text}</span>
      <span aria-hidden="true" className="wt-digits-row">
        {chars.map((char, index) => {
          // Clé par rang depuis la droite : un chiffre qui change roule au lieu
          // de se remonter à zéro.
          const key = `g-${chars.length - 1 - index}`;
          if (!/\d/.test(char)) {
            // Même hauteur de boîte que les colonnes de chiffres, sinon les
            // « h » et « min » décrochent de la ligne.
            return (
              <span key={key} className="wt-digit-static">
                {char}
              </span>
            );
          }
          return <Digit key={key} digit={Number(char)} index={index} />;
        })}
      </span>
    </span>
  );
}

function Digit({ digit, index }: { digit: number; index: number }) {
  return (
    <span className="wt-digit">
      <motion.span
        className="wt-digit-column"
        initial={{ y: 0 }}
        animate={{ y: `-${digit * DIGIT_HEIGHT_EM}em` }}
        transition={{ duration: 0.9, delay: index * 0.04, ease: EASE_OUT }}
      >
        {DIGITS.map((value) => (
          <span key={value}>{value}</span>
        ))}
      </motion.span>
    </span>
  );
}
