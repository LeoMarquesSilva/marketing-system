import type { ReactNode } from "react";
import localFont from "next/font/local";

/** Montserrat (substituta livre da Gotham) no corpo e Bebas Neue no título, como nas peças do escritório. */
const sans = localFont({
  src: "../../fonts/montserrat-latin-variable.woff2",
  weight: "300 700",
  variable: "--font-galeria-sans",
  display: "swap",
});

const display = localFont({
  src: "../../fonts/bebas-neue-latin.woff2",
  weight: "400",
  variable: "--font-galeria-display",
  display: "swap",
});

export default function GaleriaLayout({ children }: { children: ReactNode }) {
  return <div className={`${sans.variable} ${display.variable}`}>{children}</div>;
}
