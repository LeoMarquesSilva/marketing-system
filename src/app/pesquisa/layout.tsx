import type { ReactNode } from "react";
import localFont from "next/font/local";

/**
 * Mesma dupla das páginas de marca (dress code, NPS): Montserrat no corpo
 * (substituta da Gotham) e Bebas Neue nos títulos (no lugar da Gobold das peças do PE27).
 */
const sans = localFont({
  src: "../../fonts/montserrat-latin-variable.woff2",
  weight: "300 700",
  variable: "--font-survey-sans",
  display: "swap",
});

const display = localFont({
  src: "../../fonts/bebas-neue-latin.woff2",
  weight: "400",
  variable: "--font-survey-display",
  display: "swap",
});

export default function PesquisaLayout({ children }: { children: ReactNode }) {
  return <div className={`${sans.variable} ${display.variable}`}>{children}</div>;
}
