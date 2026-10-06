import { Montserrat } from "next/font/google";
import type { ReactNode } from "react";

/** Montserrat substitui a Gotham do site institucional (mesma escolha do NPS). */
const sans = Montserrat({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600"],
  variable: "--font-fc-sans",
  display: "swap",
});

export default function FichaCadastralLayout({ children }: { children: ReactNode }) {
  return <div className={sans.variable}>{children}</div>;
}
