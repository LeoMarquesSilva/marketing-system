import type { ReactNode } from "react";
import type { Metadata } from "next";
import localFont from "next/font/local";

/** Mesma dupla do comunicado da festa: Montserrat no corpo (substituta da Gotham) e Bebas Neue no título. */
const sans = localFont({
  src: "../../fonts/montserrat-latin-variable.woff2",
  weight: "400 700",
  variable: "--font-festa-sans",
  display: "swap",
});

const display = localFont({
  src: "../../fonts/bebas-neue-latin.woff2",
  weight: "400",
  variable: "--font-festa-display",
  display: "swap",
});

const PAGE_TITLE = "Convite · 10 anos | Bismarchi | Pires";
const PAGE_DESCRIPTION =
  "Celebre conosco os 10 anos do Bismarchi | Pires: 17/12, às 18h, na Fazenda Santa Margarida. Veja o dress code e confirme sua presença.";

// O mesmo título e a mesma imagem para todos os links: a prévia do WhatsApp não mostra dado do convidado.
export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    siteName: "Bismarchi | Pires",
    locale: "pt_BR",
    type: "website",
  },
};

export default function ConviteLayout({ children }: { children: ReactNode }) {
  return <div className={`${sans.variable} ${display.variable}`}>{children}</div>;
}
