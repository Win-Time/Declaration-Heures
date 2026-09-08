"use client";

import { motion, useReducedMotion } from "motion/react";

import type { ClientOption } from "@/lib/notion-types";
import { SPRING_PRESS } from "@/lib/motion-tokens";

import { CheckMark } from "../CheckMark";
import { PressableButton } from "../PressableButton";
import { Reveal } from "../Reveal";

export function StepClient({
  clients,
  loading,
  error,
  selectedId,
  onSelect,
  onBack,
  onNext,
}: {
  clients: ClientOption[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const reduce = useReducedMotion();

  return (
    <div>
      <Reveal index={0}>
        <h2 className="wt-step-title">Chez qui as-tu travaillé ?</h2>
        <div className="wt-rule" />
      </Reveal>

      <Reveal index={1}>
        <p className="wt-lead">
          Un client par déclaration. Tu en as plusieurs ? Tu recommenceras juste
          après.
        </p>
      </Reveal>

      {loading ? (
        <p className="wt-shimmer">On charge tes clients…</p>
      ) : error ? (
        <p className="wt-error" role="alert">
          {error}
        </p>
      ) : clients.length === 0 ? (
        <p className="wt-neutral">
          Aucun client ne t'est assigné pour l'instant. Contacte-nous, on règle
          ça avec toi.
        </p>
      ) : (
        <div role="radiogroup" aria-label="Tes clients">
          {clients.map((client, index) => (
            <Reveal key={client.id} index={2 + index}>
              {/*
                Visuel case à cocher, comportement radio : cocher un client
                décoche l'autre.
              */}
              <motion.button
                type="button"
                role="radio"
                aria-checked={selectedId === client.id}
                className="wt-choice"
                onClick={() => onSelect(client.id)}
                whileTap={reduce ? undefined : { scale: 0.985 }}
                transition={SPRING_PRESS}
              >
                <CheckMark />
                <span className="wt-choice-name">{client.name}</span>
              </motion.button>
            </Reveal>
          ))}
        </div>
      )}

      <div className="wt-actions">
        <PressableButton variant="ghost" onClick={onBack}>
          Retour
        </PressableButton>
        <PressableButton onClick={onNext} disabled={!selectedId}>
          Continuer
        </PressableButton>
      </div>
    </div>
  );
}
