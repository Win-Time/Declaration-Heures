"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ClientChoice, DeclarationResult } from "@/lib/notion-types";

import { splitDigits } from "./DurationInput";
import { ProgressSteps } from "./ProgressSteps";
import { StepShell } from "./StepShell";
import { WinTimeLogo } from "./WinTimeLogo";
import { StepAttestation } from "./steps/StepAttestation";
import { StepClient } from "./steps/StepClient";
import { StepConfirmation } from "./steps/StepConfirmation";
import {
  type DeclarationDraft,
  StepDeclaration,
} from "./steps/StepDeclaration";
import { StepPhone } from "./steps/StepPhone";

type Step = "phone" | "client" | "declaration" | "attestation" | "confirmation";

const ORDER: Step[] = [
  "phone",
  "client",
  "declaration",
  "attestation",
  "confirmation",
];

const HEADINGS: Record<Step, { title: string; subtitle: string }> = {
  phone: { title: "Déclare tes heures", subtitle: "Deux minutes, pas plus." },
  client: { title: "Ton client", subtitle: "Choisis chez qui tu as travaillé." },
  declaration: { title: "Ta déclaration", subtitle: "Période et temps passé." },
  attestation: { title: "Dernière étape", subtitle: "Vérifie et valide." },
  confirmation: { title: "C'est envoyé", subtitle: "Merci pour ta rigueur." },
};

export function DeclarationWizard() {
  const [step, setStep] = useState<Step>("phone");
  const [direction, setDirection] = useState<1 | -1>(1);

  const [phone, setPhone] = useState("");
  const [identifying, setIdentifying] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const [clients, setClients] = useState<ClientChoice[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const [draft, setDraft] = useState<DeclarationDraft>({
    start: null,
    end: null,
    duration: "",
  });

  const [attested, setAttested] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [result, setResult] = useState<DeclarationResult | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const clientsLoadedRef = useRef(false);

  const goTo = useCallback((next: Step) => {
    setDirection(ORDER.indexOf(next) >= ORDER.indexOf(step) ? 1 : -1);
    setStep(next);
  }, [step]);

  // Chaque changement d'étape ramène la carte dans le champ de vision (mobile).
  useEffect(() => {
    cardRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [step]);

  const loadClients = useCallback(async (force = false) => {
    // Les clients sont mis en cache pour la session : revenir à l'étape 2 ou
    // enchaîner une deuxième déclaration ne relance ni l'appel ni le shimmer.
    if (!force && clientsLoadedRef.current) return;
    setClientsLoading(true);
    setClientsError(null);
    try {
      // Aucun identifiant n'est envoyé : le serveur lit la session httpOnly.
      const response = await fetch("/api/clients", { cache: "no-store" });
      const data = (await response.json()) as {
        ok: boolean;
        clients?: ClientChoice[];
        message?: string;
      };
      if (!response.ok || !data.ok) {
        setClientsError(data.message ?? "Impossible de charger tes clients.");
        setClients([]);
        return;
      }
      setClients(data.clients ?? []);
      clientsLoadedRef.current = true;
    } catch {
      setClientsError("Connexion perdue. Réessaie dans un instant.");
    } finally {
      setClientsLoading(false);
    }
  }, []);

  const identify = useCallback(async () => {
    setIdentifying(true);
    setPhoneError(null);
    // Une nouvelle identification invalide le cache de l'assistante précédente.
    clientsLoadedRef.current = false;
    try {
      const response = await fetch("/api/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = (await response.json()) as { ok: boolean; message?: string };
      if (!data.ok) {
        setPhoneError(
          data.message ?? "On ne te trouve pas 🤔 Vérifie ton numéro ou contacte-nous.",
        );
        return;
      }
      goTo("client");
      void loadClients(true);
    } catch {
      setPhoneError("Connexion perdue. Réessaie dans un instant.");
    } finally {
      setIdentifying(false);
    }
  }, [goTo, loadClients, phone]);

  const submitDeclaration = useCallback(async () => {
    if (!selectedClientId || !draft.start || !draft.end) return;
    const { hours, minutes } = splitDigits(draft.duration);
    setSending(true);
    setSendError(null);
    try {
      const response = await fetch("/api/declaration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClientId,
          start: draft.start,
          end: draft.end,
          hours,
          minutes,
          attestation: attested,
        }),
      });
      const data = (await response.json()) as
        | ({ ok: true } & DeclarationResult)
        | { ok: false; message: string };

      if (!data.ok) {
        // On reste sur l'étape : rien de ce qui a été saisi n'est perdu.
        setSendError(data.message);
        return;
      }

      setResult({
        declarationId: data.declarationId,
        clientName: data.clientName,
        totalMinutes: data.totalMinutes,
      });
      goTo("confirmation");
    } catch {
      setSendError(
        "L'envoi a échoué. Tes infos sont toujours là, réessaie dans un instant.",
      );
    } finally {
      setSending(false);
    }
  }, [attested, draft, goTo, selectedClientId]);

  const restart = useCallback(() => {
    setSelectedClientId(null);
    setDraft({ start: null, end: null, duration: "" });
    setAttested(false);
    setResult(null);
    setSendError(null);
    goTo("client");
  }, [goTo]);

  const selectedClient = clients.find(
    (client) => client.id === selectedClientId,
  );
  const heading = HEADINGS[step];
  const stepIndex = ORDER.indexOf(step);

  return (
    <div className="wt-shell">
      <header className="wt-header">
        <div className="wt-header-inner">
          <span className="wt-star" aria-hidden="true">
            ⭐
          </span>
          <ProgressSteps current={stepIndex + 1} total={ORDER.length} />
          <WinTimeLogo />
          <h1>{heading.title}</h1>
          <p>{heading.subtitle}</p>
        </div>
      </header>

      <main className="wt-main">
        <div className="wt-card" ref={cardRef}>
          <StepShell stepKey={step} direction={direction}>
            {step === "phone" ? (
              <StepPhone
                phone={phone}
                onPhoneChange={(value) => {
                  setPhone(value);
                  if (phoneError) setPhoneError(null);
                }}
                onSubmit={identify}
                loading={identifying}
                error={phoneError}
              />
            ) : step === "client" ? (
              <StepClient
                clients={clients}
                loading={clientsLoading}
                error={clientsError}
                selectedId={selectedClientId}
                onSelect={setSelectedClientId}
                onBack={() => goTo("phone")}
                onNext={() => goTo("declaration")}
              />
            ) : step === "declaration" ? (
              <StepDeclaration
                draft={draft}
                onChange={setDraft}
                onBack={() => goTo("client")}
                onNext={() => goTo("attestation")}
              />
            ) : step === "attestation" ? (
              <StepAttestation
                clientName={selectedClient?.name ?? ""}
                draft={draft}
                attested={attested}
                onAttestChange={setAttested}
                onBack={() => goTo("declaration")}
                onSubmit={submitDeclaration}
                sending={sending}
                error={sendError}
              />
            ) : result ? (
              <StepConfirmation result={result} onRestart={restart} />
            ) : null}
          </StepShell>
        </div>
      </main>
    </div>
  );
}
