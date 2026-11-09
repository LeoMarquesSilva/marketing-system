import type { ReactNode } from "react";
import localFont from "next/font/local";

/** Mesma dupla do comunicado e do dress code: Montserrat no corpo (substituta da Gotham) e Bebas Neue no título. */
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

export default function Festa10AnosLayout({ children }: { children: ReactNode }) {
  return <div className={`${sans.variable} ${display.variable}`}>{children}</div>;
}
