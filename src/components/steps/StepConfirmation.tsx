"use client";

import type { DeclarationResult } from "@/lib/notion-types";
import { formatMinutes } from "@/lib/time";

import { PressableButton } from "../PressableButton";
import { Reveal } from "../Reveal";
import { SuccessCheck } from "../SuccessCheck";

export function StepConfirmation({
  result,
  onRestart,
}: {
  result: DeclarationResult;
  onRestart: () => void;
}) {
  return (
    <div>
      <Reveal index={0}>
        <div className="wt-confirm-head">
          <SuccessCheck />
          <h2 className="wt-step-title">C'est enregistré</h2>
        </div>
      </Reveal>

      <Reveal index={1}>
        <p className="wt-lead" style={{ textAlign: "center" }}>
          <strong>{formatMinutes(result.totalMinutes)}</strong> déclarées chez{" "}
          <strong>{result.clientName}</strong>.
        </p>
      </Reveal>

      <Reveal index={2}>
        <div className="wt-actions">
          <PressableButton onClick={onRestart}>
            Déclarer un autre client
          </PressableButton>
        </div>
      </Reveal>
    </div>
  );
}
