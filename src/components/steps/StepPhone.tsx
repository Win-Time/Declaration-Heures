"use client";

import { useRef } from "react";

import { caretAfterFormat, digitsOnly, formatPhone } from "@/lib/phone";

import { PressableButton } from "../PressableButton";
import { Reveal } from "../Reveal";
import { useShake } from "../useShake";

export function StepPhone({
  phone,
  onPhoneChange,
  onSubmit,
  loading,
  error,
}: {
  phone: string;
  onPhoneChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string | null;
}) {
  const { shaking, onAnimationEnd } = useShake(error);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Le champ est reformaté à chaque frappe (groupes de deux chiffres) et le
   * curseur est replacé sur le même chiffre, sinon les espaces ajoutés le
   * renverraient en fin de ligne.
   */
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value, selectionStart } = event.target;
    const caret = selectionStart ?? value.length;
    const digitsBeforeCaret = digitsOnly(value.slice(0, caret)).length;
    const formatted = formatPhone(value);

    onPhoneChange(formatted);

    const nextCaret = caretAfterFormat(formatted, digitsBeforeCaret);
    requestAnimationFrame(() => {
      inputRef.current?.setSelectionRange(nextCaret, nextCaret);
    });
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <Reveal index={0}>
        <h2 className="wt-step-title">On commence par toi</h2>
        <div className="wt-rule" />
      </Reveal>

      <Reveal index={1}>
        <p className="wt-lead">
          Saisi ton numéro de téléphone pour qu'on puisse t'identifier
        </p>
      </Reveal>

      <Reveal index={2}>
        <label className="wt-field">
          <span className="wt-field-label">Ton numéro de téléphone</span>
          <input
            ref={inputRef}
            className={`wt-input${error ? " is-error" : ""}${shaking ? " is-shaking" : ""}`}
            onAnimationEnd={onAnimationEnd}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            name="phone"
            placeholder="06 12 34 56 78"
            value={phone}
            onChange={handleChange}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "phone-error" : undefined}
          />
        </label>
      </Reveal>

      {error ? (
        <p className="wt-error" id="phone-error" role="alert">
          {error}
        </p>
      ) : null}

      <Reveal index={3}>
        <div className="wt-actions">
          <PressableButton type="submit" disabled={loading || phone.trim() === ""}>
            {loading ? "On te cherche…" : "C'est parti 🚀"}
          </PressableButton>
        </div>
      </Reveal>
    </form>
  );
}
