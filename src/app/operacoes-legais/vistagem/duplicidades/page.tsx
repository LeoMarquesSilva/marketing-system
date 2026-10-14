import type { Metadata } from "next";
import { DuplicidadesClient } from "@/components/operacoes-legais/vistagem/duplicidades-client";

export const metadata: Metadata = {
  title: "Vistagem — Duplicidades — ORQESTRAI",
  description: "Conferência das publicações marcadas como duplicidade.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function VistagemDuplicidadesPage() {
  return <DuplicidadesClient />;
}
