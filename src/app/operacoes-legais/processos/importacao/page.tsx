import type { Metadata } from "next";
import { ImportacaoClient } from "@/components/operacoes-legais/processos/importacao-client";

export const metadata: Metadata = {
  title: "Processos — Importação e VIOS — ORQESTRAI",
  description: "Carga dos processos do VIOS e fila de gravação de volta.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function ProcessosImportacaoPage() {
  return <ImportacaoClient />;
}
