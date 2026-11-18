import type { Metadata } from "next";
import { CadastrosClient } from "@/components/operacoes-legais/processos/cadastros-client";

export const metadata: Metadata = {
  title: "Processos — Cadastros — ORQESTRAI",
  description: "Opções dos campos de escolha do cadastro de processos.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function ProcessosCadastrosPage() {
  return <CadastrosClient />;
}
