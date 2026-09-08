"use client";

import type { DeclarationResult } from "@/lib/notion-types";
import { formatMinutes } from "@/lib/time";

import { ForfaitBar } from "../ForfaitBar";
import { PressableButton } from "../PressableButton";
import { Reveal } from "../Reveal";
import { RollingNumber } from "../RollingNumber";
import { SuccessCheck } from "../SuccessCheck";

export function StepConfirmation({
  result,
  onRestart,
}: {
  result: DeclarationResult;
  onRestart: () => void;
}) {
  const forfaitMinutes =
    result.forfaitHours !== null ? Math.round(result.forfaitHours * 60) : null;
  const over =
    forfaitMinutes !== null && result.consumedMinutes > forfaitMinutes;
  const excess = forfaitMinutes !== null ? result.consumedMinutes - forfaitMinutes : 0;

  return (
    <div>
      <Reveal index={0}>
        <div className="wt-confirm-head">
          <SuccessCheck />
          <h2 className="wt-step-title">Point sur la situation</h2>
        </div>
      </Reveal>

      <Reveal index={1}>
        <p className="wt-lead" style={{ textAlign: "center" }}>
          C'est enregistré : {formatMinutes(result.totalMinutes)} déclarées chez{" "}
          <strong>{result.clientName}</strong>.
        </p>
      </Reveal>

      {forfaitMinutes === null ? (
        <Reveal index={2}>
          <p className="wt-neutral">
            Aucun forfait n'est renseigné au contrat de ce client : on ne peut
            pas afficher ton cumul du mois, mais ta déclaration est bien
            enregistrée.
          </p>
        </Reveal>
      ) : (
        <>
          <Reveal index={2}>
            <p className="wt-lead">
              Tu as passé{" "}
              <span className="wt-figure">
                <RollingNumber text={formatMinutes(result.consumedMinutes)} />
              </span>{" "}
              sur les <strong>{result.forfaitHours}h</strong> prévues par mois
              chez <strong>{result.clientName}</strong>
              {over ? "." : ", attention à ne pas les excéder."}
            </p>
          </Reveal>

          <Reveal index={3}>
            <ForfaitBar
              consumedMinutes={result.consumedMinutes}
              forfaitMinutes={forfaitMinutes}
            />
          </Reveal>

          {over ? (
            <Reveal index={4}>
              <p className="wt-alert" role="status">
                Tu as dépassé le forfait de{" "}
                <strong>{formatMinutes(excess)}</strong> ce mois-ci.
              </p>
            </Reveal>
          ) : null}
        </>
      )}

      <Reveal index={5}>
        <div className="wt-punch">
          <span>🚀</span>
          <span>Déclaré, c'est réglé.</span>
        </div>
      </Reveal>

      <Reveal index={6}>
        <div className="wt-actions">
          <PressableButton onClick={onRestart}>
            Déclarer un autre client
          </PressableButton>
        </div>
      </Reveal>
    </div>
  );
}
