import { NextResponse } from "next/server";

import {
  NotionSchemaError,
  createDeclaration,
  listClientsForAssistante,
} from "@/lib/notion";
import { readSession } from "@/lib/session";
import { toTotalMinutes } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type Payload = {
  clientId?: unknown;
  start?: unknown;
  end?: unknown;
  hours?: unknown;
  minutes?: unknown;
  attestation?: unknown;
};

function asInteger(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null;
  return parsed;
}

function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(request: Request) {
  const assistanteId = await readSession();
  if (!assistanteId) {
    return fail("Session expirée. Reprends depuis ton numéro.", 401);
  }

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return fail("Déclaration illisible.");
  }

  const clientId = typeof payload.clientId === "string" ? payload.clientId : "";
  const start = typeof payload.start === "string" ? payload.start : "";
  const end = typeof payload.end === "string" ? payload.end : "";
  const hours = asInteger(payload.hours ?? 0);
  const minutes = asInteger(payload.minutes ?? 0);

  if (payload.attestation !== true) {
    return fail("Il faut cocher l'attestation avant d'envoyer.");
  }
  if (!clientId) return fail("Choisis un client.");
  if (!ISO_DATE.test(start) || !ISO_DATE.test(end)) {
    return fail("Renseigne une période valide.");
  }
  if (end < start) return fail("La date de fin doit être après la date de début.");
  if (hours === null || minutes === null || hours < 0 || minutes < 0 || minutes > 59) {
    return fail("Le temps saisi n'est pas valide (minutes entre 0 et 59).");
  }

  const totalMinutes = toTotalMinutes(hours, minutes);
  if (totalMinutes <= 0) return fail("Le temps déclaré doit être supérieur à 0.");

  try {
    // Le client déclaré doit appartenir à l'assistante en session : une valeur
    // forgée côté navigateur ne passe pas.
    const clients = await listClientsForAssistante(assistanteId);
    const selected = clients.find((client) => client.id === clientId);
    if (!selected) return fail("Ce client n'est pas dans ta liste.", 403);

    const declarationId = await createDeclaration({
      assistanteId,
      clientId: selected.id,
      clientName: selected.name,
      contratId: selected.contratId,
      start,
      end,
      totalMinutes,
    });

    return NextResponse.json({
      ok: true,
      declarationId,
      clientName: selected.name,
      totalMinutes,
    });
  } catch (error) {
    console.error("[win-time] écriture de la déclaration impossible", error);

    // Un schéma qui ne correspond pas ne se règle pas en réessayant : on le dit
    // plutôt que d'inviter l'assistante à recommencer pour rien.
    if (error instanceof NotionSchemaError) {
      return fail(
        "Un réglage côté Notion empêche l'enregistrement. Préviens-nous, on corrige ça — tes infos restent là.",
        502,
      );
    }

    // Statut 502 : le formulaire garde les données saisies et propose de réessayer.
    return fail(
      "L'envoi vers Notion a échoué. Tes infos sont toujours là, réessaie dans un instant.",
      502,
    );
  }
}
