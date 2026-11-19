import type { Metadata } from "next";
import { DegustacaoListClient } from "@/components/eventos/degustacao/degustacao-list-client";

export const metadata: Metadata = {
  title: "Degustações de drinks · ORQESTRAI",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

/** Lista das degustações de drinks (a de hoje em cima), para abrir a votação pelo celular. */
export default function DegustacoesPage() {
  return <DegustacaoListClient />;
}
