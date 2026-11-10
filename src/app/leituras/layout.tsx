import type { ReactNode } from "react";
import localFont from "next/font/local";

const sans = localFont({
  src: "../../fonts/montserrat-latin-variable.woff2",
  weight: "200 700",
  variable: "--font-reading-sans",
  display: "swap",
});

export default function ReadingsPublicLayout({ children }: { children: ReactNode }) {
  return <div className={sans.variable}>{children}</div>;
}
