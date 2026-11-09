import type { ReactNode } from "react";
import localFont from "next/font/local";

/** Montserrat no corpo (substituta da Gotham); Bebas Neue no título, como no comunicado. */
const sans = localFont({
  src: "../../fonts/montserrat-latin-variable.woff2",
  weight: "300 600",
  variable: "--font-dress-sans",
  display: "swap",
});

const display = localFont({
  src: "../../fonts/bebas-neue-latin.woff2",
  weight: "400",
  variable: "--font-dress-display",
  display: "swap",
});

export default function DressCodeLayout({ children }: { children: ReactNode }) {
  return <div className={`${sans.variable} ${display.variable}`}>{children}</div>;
}
