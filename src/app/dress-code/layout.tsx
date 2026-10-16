import type { ReactNode } from "react";
import { Bebas_Neue, Montserrat } from "next/font/google";

/** Montserrat no corpo (substituta da Gotham); Bebas Neue no título, como no comunicado. */
const sans = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-dress-sans",
  display: "swap",
});

const display = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-dress-display",
  display: "swap",
});

export default function DressCodeLayout({ children }: { children: ReactNode }) {
  return <div className={`${sans.variable} ${display.variable}`}>{children}</div>;
}
