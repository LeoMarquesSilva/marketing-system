import { Montserrat } from "next/font/google";
import type { ReactNode } from "react";

/**
 * Montserrat é o substituto livre mais próximo da Gotham, usada no site
 * institucional do escritório (bismarchipires.com.br). Pesos leves (200/300)
 * reproduzem o tratamento GothamLight dos títulos.
 */
const sans = Montserrat({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600"],
  variable: "--font-nps-sans",
  display: "swap",
});

export default function PublicNpsLayout({ children }: { children: ReactNode }) {
  return <div className={sans.variable}>{children}</div>;
}
