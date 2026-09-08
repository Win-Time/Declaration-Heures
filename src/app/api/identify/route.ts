import { NextResponse } from "next/server";

import { findAssistanteByPhone } from "@/lib/notion";
import { isPlausiblePhone } from "@/lib/phone";
import { createSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Même message quel que soit l'échec : on ne dit jamais si un numéro existe. */
const NOT_FOUND = "On ne te trouve pas 🤔 Vérifie ton numéro ou contacte-nous.";

export async function POST(request: Request) {
  let phone = "";
  try {
    const body = (await request.json()) as { phone?: unknown };
    phone = typeof body.phone === "string" ? body.phone : "";
  } catch {
    return NextResponse.json({ ok: false, message: NOT_FOUND }, { status: 400 });
  }

  if (!isPlausiblePhone(phone)) {
    return NextResponse.json({ ok: false, message: NOT_FOUND }, { status: 200 });
  }

  try {
    const assistante = await findAssistanteByPhone(phone);
    if (!assistante) {
      return NextResponse.json({ ok: false, message: NOT_FOUND }, { status: 200 });
    }

    await createSession(assistante.id);
    // La réponse ne contient aucun identifiant : la session vit dans un cookie
    // httpOnly signé, jamais dans le state client.
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[win-time] identification impossible", error);
    return NextResponse.json(
      {
        ok: false,
        message: "Connexion à Notion impossible pour le moment. Réessaie dans un instant.",
      },
      { status: 502 },
    );
  }
}
