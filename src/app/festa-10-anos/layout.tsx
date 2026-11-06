import type { ReactNode } from "react";
import { Bebas_Neue, Montserrat } from "next/font/google";

/** Mesma dupla do comunicado e do dress code: Montserrat no corpo (substituta da Gotham) e Bebas Neue no título. */
const sans = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-festa-sans",
  display: "swap",
});

const display = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-festa-display",
  display: "swap",
});

export default function Festa10AnosLayout({ children }: { children: ReactNode }) {
  return <div className={`${sans.variable} ${display.variable}`}>{children}</div>;
}
