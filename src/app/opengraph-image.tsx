import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Déclare tes heures — Win Time";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FONT_DIR = join(process.cwd(), "src", "app", "_fonts");
const LOGO_PATH = join(process.cwd(), "public", "win-time-logo.svg");

/**
 * Aperçu de partage (Open Graph / Twitter).
 *
 * Rendu par satori : les polices sont embarquées depuis le dépôt plutôt que
 * chargées depuis Google Fonts, pour que la génération ne dépende d'aucun
 * appel réseau. Le logo est passé en data URI, posé sur une pastille blanche —
 * son dégradé est celui du fond, il y disparaîtrait sinon.
 */
export default async function OpengraphImage() {
  const [yellowtail, questrial, logo] = await Promise.all([
    readFile(join(FONT_DIR, "Yellowtail-Regular.ttf")),
    readFile(join(FONT_DIR, "Questrial-Regular.ttf")),
    readFile(LOGO_PATH, "utf8"),
  ]);

  const logoDataUri = `data:image/svg+xml;base64,${Buffer.from(logo).toString("base64")}`;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        // Dégradé posts de la charte.
        backgroundImage:
          "linear-gradient(170deg, #E13356 0%, #DB4841 55%, #D55A30 100%)",
        color: "#FFFFFF",
        padding: "72px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "148px",
          height: "148px",
          borderRadius: "74px",
          background: "#FFFFFF",
          marginBottom: "44px",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoDataUri} width={112} height={112} alt="" />
      </div>

      <div
        style={{
          fontFamily: "Yellowtail",
          fontSize: "104px",
          lineHeight: 1.1,
          textAlign: "center",
        }}
      >
        Déclare tes heures
      </div>

      <div
        style={{
          fontFamily: "Questrial",
          fontSize: "34px",
          marginTop: "22px",
          opacity: 0.95,
        }}
      >
        Win Time — deux minutes, pas plus.
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Yellowtail", data: yellowtail, style: "normal", weight: 400 },
        { name: "Questrial", data: questrial, style: "normal", weight: 400 },
      ],
    },
  );
}
