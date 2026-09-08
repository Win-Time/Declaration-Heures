"use client";

import { useState } from "react";

import { PressableButton } from "../PressableButton";
import { Reveal } from "../Reveal";
import { useShake } from "../useShake";

export type DeclarationDraft = {
  start: string;
  end: string;
  hours: string;
  minutes: string;
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
      return "Renseigne le début et la fin de ta période.";
    }
    if (draft.end < draft.start) {
      return "La date de fin doit être après la date de début.";
    }
    const hours = Number(draft.hours || 0);
    const minutes = Number(draft.minutes || 0);
    if (!Number.isInteger(hours) || hours < 0) {
      return "Les heures doivent être un nombre entier positif.";
    }
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
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

  const fieldClass = `wt-input${error ? " is-error" : ""}${shaking ? " is-shaking" : ""}`;

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
        <div className="wt-field-row">
          <label className="wt-field">
            <span className="wt-field-label">Début</span>
            <input
              className={fieldClass}
              onAnimationEnd={onAnimationEnd}
              type="date"
              value={draft.start}
              max={draft.end || undefined}
              onChange={(event) => patch({ start: event.target.value })}
            />
          </label>
          <label className="wt-field">
            <span className="wt-field-label">Fin</span>
            <input
              className={fieldClass}
              onAnimationEnd={onAnimationEnd}
              type="date"
              value={draft.end}
              min={draft.start || undefined}
              onChange={(event) => patch({ end: event.target.value })}
            />
          </label>
        </div>
      </Reveal>

      <Reveal index={3}>
        <div className="wt-field-row">
          <label className="wt-field">
            <span className="wt-field-label">Heures</span>
            <input
              className={fieldClass}
              onAnimationEnd={onAnimationEnd}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              placeholder="0"
              value={draft.hours}
              onChange={(event) => patch({ hours: event.target.value })}
            />
          </label>
          <label className="wt-field">
            <span className="wt-field-label">Minutes</span>
            <input
              className={fieldClass}
              onAnimationEnd={onAnimationEnd}
              type="number"
              inputMode="numeric"
              min={0}
              max={59}
              step={1}
              placeholder="0"
              value={draft.minutes}
              onChange={(event) => patch({ minutes: event.target.value })}
            />
          </label>
        </div>
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
