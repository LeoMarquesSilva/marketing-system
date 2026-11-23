import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Minidocumentário 10 anos — ORQESTRAI",
  robots: { index: false, follow: false },
};

export default function DocumentarioLayout({ children }: { children: ReactNode }) {
  return children;
}
