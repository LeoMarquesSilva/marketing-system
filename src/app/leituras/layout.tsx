import type { ReactNode } from "react";
import { Montserrat } from "next/font/google";

const sans = Montserrat({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700"],
  variable: "--font-reading-sans",
  display: "swap",
});

export default function ReadingsPublicLayout({ children }: { children: ReactNode }) {
  return <div className={sans.variable}>{children}</div>;
}
