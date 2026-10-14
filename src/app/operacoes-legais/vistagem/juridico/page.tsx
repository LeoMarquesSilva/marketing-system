import type { Metadata } from "next";
import { JuridicoClient } from "@/components/operacoes-legais/vistagem/juridico-client";

export const metadata: Metadata = {
  title: "Vistagem — Jurídico — ORQESTRAI",
  description: "Vistagem das publicações: tarefas do VIOS vinculadas a cada publicação.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function VistagemJuridicoPage() {
  return <JuridicoClient />;
}
