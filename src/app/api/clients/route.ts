import { NextResponse } from "next/server";

import { listClientsForAssistante } from "@/lib/notion";
import { readSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Clients de l'assistante identifiée — dérivés du cookie de session, jamais
 * d'un identifiant fourni par le client. Aucun paramètre n'est accepté : il
 * n'existe donc pas de moyen de demander les clients de quelqu'un d'autre.
 */
export async function GET() {
  const assistanteId = await readSession();
  if (!assistanteId) {
    return NextResponse.json(
      { ok: false, message: "Session expirée. Reprends depuis ton numéro." },
      { status: 401 },
    );
  }

  try {
    const clients = await listClientsForAssistante(assistanteId);
    return NextResponse.json({ ok: true, clients });
  } catch (error) {
    console.error("[win-time] récupération des clients impossible", error);
    return NextResponse.json(
      {
        ok: false,
        message: "On n'arrive pas à charger tes clients. Réessaie dans un instant.",
      },
      { status: 502 },
    );
  }
}
