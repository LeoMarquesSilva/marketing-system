import type { Metadata } from "next";
import { OperacoesLegaisClient } from "@/components/operacoes-legais/operacoes-legais-client";

export const metadata: Metadata = {
  title: "Operações Legais — ORQESTRAI",
  description: "Módulo de Operações Legais.",
  robots: { index: false, follow: false },
};

export default function OperacoesLegaisPage() {
  return <OperacoesLegaisClient />;
}
