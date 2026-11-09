import localFont from "next/font/local";
import type { ReactNode } from "react";

/** Montserrat substitui a Gotham do site institucional (mesma escolha do NPS). */
const sans = localFont({
  src: "../../../fonts/montserrat-latin-variable.woff2",
  weight: "200 600",
  variable: "--font-fc-sans",
  display: "swap",
});

export default function FichaCadastralLayout({ children }: { children: ReactNode }) {
  return <div className={sans.variable}>{children}</div>;
}
