import type { Metadata } from "next";
import { SaneamentoClient } from "@/components/operacoes-legais/processos/saneamento-client";

export const metadata: Metadata = {
  title: "Processos — Saneamento — ORQESTRAI",
  description: "O que falta em cada processo para fechar a lista de campos da equipe.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function ProcessosSaneamentoPage() {
  return <SaneamentoClient />;
}
