import localFont from "next/font/local";
import type { ReactNode } from "react";

const sans = localFont({
  src: [
    { path: "../../../fonts/source-sans-3-latin-variable.woff2", weight: "400 600", style: "normal" },
    { path: "../../../fonts/source-sans-3-italic-latin-variable.woff2", weight: "400 600", style: "italic" },
  ],
  variable: "--font-pp-sans",
  display: "swap",
});

export default function PublicProfileLayout({ children }: { children: ReactNode }) {
  return <div className={sans.variable}>{children}</div>;
}
