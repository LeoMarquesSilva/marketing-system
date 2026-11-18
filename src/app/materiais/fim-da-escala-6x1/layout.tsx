import type { ReactNode } from "react";
import type { Metadata } from "next";
import localFont from "next/font/local";

/** Montserrat no corpo (substituta da Gotham) e Bebas Neue nos títulos, como nas páginas abertas a clientes. */
const sans = localFont({
  src: "../../../fonts/montserrat-latin-variable.woff2",
  weight: "300 700",
  variable: "--font-material-sans",
  display: "swap",
});

const display = localFont({
  src: "../../../fonts/bebas-neue-latin.woff2",
  weight: "400",
  variable: "--font-material-display",
  display: "swap",
});

const TITLE = "Fim da escala 6x1: o que sua empresa precisa saber | Bismarchi | Pires";
const DESCRIPTION =
  "E-book gratuito da área Trabalhista do Bismarchi | Pires para gestores, RHs e empresários: jornada, descanso semanal, normas coletivas, impactos operacionais e riscos trabalhistas.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: "Bismarchi | Pires", locale: "pt_BR", type: "website" },
};

export default function Material6x1Layout({ children }: { children: ReactNode }) {
  return <div className={`${sans.variable} ${display.variable}`}>{children}</div>;
}
