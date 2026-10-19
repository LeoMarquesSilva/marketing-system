import { Montserrat } from "next/font/google";
import type { ReactNode } from "react";

/** Mesma tipografia da ficha de admissão (Montserrat no lugar da Gotham). */
const sans = Montserrat({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600"],
  variable: "--font-fc-sans",
  display: "swap",
});

export default function MinhaFichaLayout({ children }: { children: ReactNode }) {
  return <div className={sans.variable}>{children}</div>;
}
