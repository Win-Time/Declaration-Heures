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

export const metadata: Metadata = {
  title: "Déclare tes heures — Win Time",
  description:
    "Le formulaire Win Time pour déclarer les heures passées chez tes clients.",
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
