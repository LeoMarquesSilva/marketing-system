import localFont from "next/font/local";
import type { ReactNode } from "react";

/**
 * Montserrat é o substituto livre mais próximo da Gotham, usada no site
 * institucional do escritório (bismarchipires.com.br). Pesos leves (200/300)
 * reproduzem o tratamento GothamLight dos títulos.
 */
const sans = localFont({
  src: "../../../fonts/montserrat-latin-variable.woff2",
  weight: "200 600",
  variable: "--font-nps-sans",
  display: "swap",
});

export default function PublicNpsLayout({ children }: { children: ReactNode }) {
  return <div className={sans.variable}>{children}</div>;
}
