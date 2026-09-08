import type { Metadata, Viewport } from "next";
import { Open_Sans, Questrial, Yellowtail } from "next/font/google";

import "./globals.css";

// Équivalents Google Fonts des polices Canva de la charte.
const yellowtail = Yellowtail({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-yellowtail",
  display: "swap",
});

const questrial = Questrial({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-questrial",
  display: "swap",
});

const openSans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-open-sans",
  display: "swap",
});

/**
 * Base des URLs absolues des métadonnées (image de partage comprise).
 *
 * Lue à l'exécution : sur Vercel, `VERCEL_PROJECT_PRODUCTION_URL` suffit et
 * ne demande aucune configuration. `SITE_URL` permet de forcer un domaine
 * personnalisé.
 */
function siteUrl(): URL {
  const explicit = process.env.SITE_URL;
  if (explicit) return new URL(explicit);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return new URL(`https://${vercel}`);
  return new URL("http://localhost:3000");
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: "Déclare tes heures — Win Time",
  description:
    "Le formulaire Win Time pour déclarer les heures passées chez tes clients.",
  // Formulaire interne : il ne doit jamais ressortir dans un moteur de
  // recherche. Le partage de lien, lui, reste possible.
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      "max-snippet": -1,
      "max-image-preview": "none",
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: "Win Time",
    locale: "fr_FR",
    title: "Déclare tes heures",
    description:
      "Le formulaire Win Time pour déclarer tes heures chez tes clients.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Déclare tes heures",
    description:
      "Le formulaire Win Time pour déclarer tes heures chez tes clients.",
  },
};

export const viewport: Viewport = {
  themeColor: "#e13356",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Les variables de police sont posées sur <html> : la charte les lit
    // depuis `:root`, pas depuis `body`.
    <html
      lang="fr"
      className={`${yellowtail.variable} ${questrial.variable} ${openSans.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
