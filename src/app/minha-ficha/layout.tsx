import localFont from "next/font/local";
import type { ReactNode } from "react";

/** Mesma tipografia da ficha de admissão (Montserrat no lugar da Gotham). */
const sans = localFont({
  src: "../../fonts/montserrat-latin-variable.woff2",
  weight: "200 600",
  variable: "--font-fc-sans",
  display: "swap",
});

export default function MinhaFichaLayout({ children }: { children: ReactNode }) {
  return <div className={sans.variable}>{children}</div>;
}
