"use client";

import { useRef } from "react";

/**
 * Saisie du temps en un seul champ, affiché "HHhMM".
 *
 * La valeur est une suite de chiffres qui se remplit par la droite, comme un
 * chronomètre : 2 → 00h02, 21 → 00h21, 215 → 02h15, 1030 → 10h30. Le "h" est
 * rendu par le champ, jamais saisi.
 */
export function DurationInput({
  digits,
  onDigitsChange,
  invalid,
  onAnimationEnd,
  shaking,
}: {
  digits: string;
  onDigitsChange: (digits: string) => void;
  invalid?: boolean;
  shaking?: boolean;
  onAnimationEnd?: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // On ne lit que les chiffres : effacer un caractère du masque revient donc
    // à retirer le dernier chiffre saisi.
    const next = event.target.value.replace(/[^0-9]/g, "").slice(-4);
    onDigitsChange(next.replace(/^0+(?=\d)/, ""));
  };

  return (
    <div className="wt-duration">
      <input
        ref={ref}
        className={`wt-input wt-duration-input${invalid ? " is-error" : ""}${shaking ? " is-shaking" : ""}`}
        onAnimationEnd={onAnimationEnd}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={digits === "" ? "" : formatDigits(digits)}
        onChange={handleChange}
        placeholder="00h00"
        aria-label="Temps passé, en heures et minutes"
        // Le curseur reste en fin de champ : la saisie se fait par la droite.
        onSelect={() => {
          const input = ref.current;
          if (!input) return;
          const end = input.value.length;
          if (input.selectionStart !== end || input.selectionEnd !== end) {
            input.setSelectionRange(end, end);
          }
        }}
      />
    </div>
  );
}

/** "215" -> "02h15". */
export function formatDigits(digits: string): string {
  const padded = digits.padStart(4, "0");
  return `${padded.slice(0, 2)}h${padded.slice(2)}`;
}

/** Heures et minutes portées par la suite de chiffres. */
export function splitDigits(digits: string): { hours: number; minutes: number } {
  const padded = digits.padStart(4, "0");
  return {
    hours: Number(padded.slice(0, 2)),
    minutes: Number(padded.slice(2)),
  };
}
