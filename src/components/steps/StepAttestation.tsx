"use client";

import { motion, useReducedMotion } from "motion/react";

import { SPRING_PRESS } from "@/lib/motion-tokens";
import { formatRange } from "@/lib/calendar";
import { formatMinutes, toTotalMinutes } from "@/lib/time";

import { CheckMark } from "../CheckMark";
import { splitDigits } from "../DurationInput";
import { PressableButton } from "../PressableButton";
import { Reveal } from "../Reveal";
import type { DeclarationDraft } from "./StepDeclaration";

export function StepAttestation({
  clientName,
  draft,
  attested,
  onAttestChange,
  onBack,
  onSubmit,
  sending,
  error,
}: {
  clientName: string;
  draft: DeclarationDraft;
  attested: boolean;
  onAttestChange: (value: boolean) => void;
  onBack: () => void;
  onSubmit: () => void;
  sending: boolean;
  error: string | null;
}) {
  const reduce = useReducedMotion();
  const { hours, minutes } = splitDigits(draft.duration);
  const totalMinutes = toTotalMinutes(hours, minutes);

  return (
    <div>
      <Reveal index={0}>
        <h2 className="wt-step-title">On récapitule</h2>
        <div className="wt-rule" />
      </Reveal>

      <Reveal index={1}>
        <div className="wt-recap">
          <div className="wt-recap-row">
            <span>Client</span>
            <span>{clientName}</span>
          </div>
          <div className="wt-recap-row">
            <span>Période</span>
            <span>{formatRange(draft.start, draft.end)}</span>
          </div>
          <div className="wt-recap-row">
            <span>Temps déclaré</span>
            <span>{formatMinutes(totalMinutes)}</span>
          </div>
        </div>
      </Reveal>

      <Reveal index={2}>
        <motion.button
          type="button"
          role="checkbox"
          aria-checked={attested}
          className="wt-attestation"
          onClick={() => onAttestChange(!attested)}
          whileTap={reduce ? undefined : { scale: 0.99 }}
          transition={SPRING_PRESS}
        >
          <CheckMark />
          {/* La phrase tient sur une ligne : sa taille suit la largeur du bloc
              (unités de conteneur), elle ne se coupe jamais en deux. */}
          <span className="wt-attestation-fit">
            <span className="wt-attestation-text">
              Je certifie que les informations déclarées sont exactes.
            </span>
          </span>
        </motion.button>
      </Reveal>

      {error ? (
        <p className="wt-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="wt-actions">
        <PressableButton variant="ghost" onClick={onBack} disabled={sending}>
          Retour
        </PressableButton>
        {/* Envoi impossible tant que l'attestation n'est pas cochée. */}
        <PressableButton onClick={onSubmit} disabled={!attested || sending}>
          {sending ? "Envoi en cours…" : "Envoyer ma déclaration ✔"}
        </PressableButton>
      </div>
    </div>
  );
}
