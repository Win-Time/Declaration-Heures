import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Session serveur minimale : un cookie httpOnly signé qui ne contient que
 * l'ID de page Notion de l'assistante identifiée.
 *
 * Le client ne manipule jamais cet ID : il ne peut donc pas se faire passer
 * pour une autre assistante en modifiant son state local.
 */

const COOKIE_NAME = "wt_session";
const MAX_AGE_SECONDS = 60 * 60 * 4; // 4 h — le temps d'une déclaration

type SessionPayload = {
  /** ID de la page Notion de l'assistante. */
  assistanteId: string;
  /** Expiration (epoch secondes). */
  exp: number;
};

function secret(): string {
  const value = process.env.SESSION_SECRET ?? process.env.NOTION_TOKEN;
  if (!value) {
    throw new Error(
      "SESSION_SECRET (ou à défaut NOTION_TOKEN) doit être défini pour signer la session.",
    );
  }
  return value;
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function serialize(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function deserialize(token: string): SessionPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  if (!safeEqual(signature, sign(body))) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (typeof payload.assistanteId !== "string" || !payload.assistanteId) {
      return null;
    }
    if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function createSession(assistanteId: string): Promise<void> {
  const payload: SessionPayload = {
    assistanteId,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
  };
  const store = await cookies();
  store.set(COOKIE_NAME, serialize(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/** ID de l'assistante en session, ou null si la session est absente/invalide. */
export async function readSession(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return deserialize(token)?.assistanteId ?? null;
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
