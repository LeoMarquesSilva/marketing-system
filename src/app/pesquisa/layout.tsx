import type { ReactNode } from "react";
import { Bebas_Neue, Montserrat } from "next/font/google";

/**
 * Mesma dupla das páginas de marca (dress code, NPS): Montserrat no corpo
 * (substituta da Gotham) e Bebas Neue nos títulos (no lugar da Gobold das peças do PE27).
 */
const sans = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-survey-sans",
  display: "swap",
});

const display = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-survey-display",
  display: "swap",
});

export default function PesquisaLayout({ children }: { children: ReactNode }) {
  return <div className={`${sans.variable} ${display.variable}`}>{children}</div>;
}
