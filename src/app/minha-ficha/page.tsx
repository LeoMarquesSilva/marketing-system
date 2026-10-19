import type { Metadata } from "next";
import { MinhaFichaClient } from "./minha-ficha-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Minha ficha cadastral — Bismarchi | Pires",
  description: "Atualização da ficha cadastral — Pessoas e Cultura, Bismarchi | Pires.",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

/** Atualização da ficha pelo próprio colaborador (login exigido pelo proxy e pelo AuthGuard). */
export default function MinhaFichaPage() {
  return <MinhaFichaClient />;
}
