import { Source_Sans_3 } from "next/font/google";
import type { ReactNode } from "react";

const sans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-pp-sans",
  display: "swap",
});

export default function PublicProfileLayout({ children }: { children: ReactNode }) {
  return <div className={sans.variable}>{children}</div>;
}
