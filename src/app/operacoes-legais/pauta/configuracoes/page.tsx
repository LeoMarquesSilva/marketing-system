import type { Metadata } from "next";
import { ConfiguracoesClient } from "@/components/operacoes-legais/pauta/configuracoes-client";

export const metadata: Metadata = {
  title: "Configurações da pauta — ORQESTRAI",
  description: "Equipe, leituras, avisos e convites da Pauta de Audiências.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function ConfiguracoesPautaPage() {
  return <ConfiguracoesClient />;
}
