"use client";

import { useState } from "react";

import type { IsoDate } from "@/lib/calendar";

import { DateRangePicker } from "../DateRangePicker";
import { DurationInput, splitDigits } from "../DurationInput";
import { PressableButton } from "../PressableButton";
import { Reveal } from "../Reveal";
import { useShake } from "../useShake";

export type DeclarationDraft = {
  start: IsoDate | null;
  end: IsoDate | null;
  /** Suite de chiffres du champ de temps ("215" = 02h15). */
  duration: string;
};

export function StepDeclaration({
  draft,
  onChange,
  onBack,
  onNext,
}: {
  draft: DeclarationDraft;
  onChange: (draft: DeclarationDraft) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  // Le compteur rejoue le shake même quand deux tentatives échouent sur le
  // même message.
  const [attempt, setAttempt] = useState(0);
  const { shaking, onAnimationEnd } = useShake(attempt);

  const patch = (partial: Partial<DeclarationDraft>) => {
    onChange({ ...draft, ...partial });
    if (error) setError(null);
  };

  const validate = () => {
    if (!draft.start || !draft.end) {
      return "Choisis ta période : une date de début et une date de fin.";
    }
    if (draft.end < draft.start) {
      return "La date de fin doit être après la date de début.";
    }
    const { hours, minutes } = splitDigits(draft.duration);
    if (minutes > 59) {
      return "Les minutes doivent être comprises entre 0 et 59.";
    }
    if (hours * 60 + minutes <= 0) {
      return "Le temps déclaré doit être supérieur à 0.";
    }
    return null;
  };

  const submit = () => {
    const message = validate();
    if (message) {
      setError(message);
      setAttempt((count) => count + 1);
      return;
    }
    onNext();
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Reveal index={0}>
        <h2 className="wt-step-title">Ta période et ton temps</h2>
        <div className="wt-rule" />
      </Reveal>

      <Reveal index={1}>
        <p className="wt-lead">
          Indique la période déclarée, puis le temps que tu y as passé.
        </p>
      </Reveal>

      <Reveal index={2}>
        <DateRangePicker
          start={draft.start}
          end={draft.end}
          onChange={(range) => patch(range)}
          invalid={error !== null && (!draft.start || !draft.end)}
        />
      </Reveal>

      <Reveal index={3}>
        <label className="wt-field">
          <span className="wt-field-label">Temps passé</span>
          <DurationInput
            digits={draft.duration}
            onDigitsChange={(duration) => patch({ duration })}
            invalid={error !== null}
            shaking={shaking}
            onAnimationEnd={onAnimationEnd}
          />
        </label>
      </Reveal>

      {error ? (
        <p className="wt-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="wt-actions">
        <PressableButton variant="ghost" onClick={onBack}>
          Retour
        </PressableButton>
        <PressableButton type="submit">Continuer</PressableButton>
      </div>
    </form>
  );
}
