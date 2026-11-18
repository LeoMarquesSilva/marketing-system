import type { Metadata } from "next";
import { ProcessosClient } from "@/components/operacoes-legais/processos/processos-client";

export const metadata: Metadata = {
  title: "Processos — ORQESTRAI",
  description: "Cadastro de processos de Operações Legais.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function ProcessosPage() {
  return <ProcessosClient />;
}
