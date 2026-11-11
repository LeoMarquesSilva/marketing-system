import type { Metadata } from "next";
import { ConfiguracoesClient } from "@/components/operacoes-legais/vistagem/configuracoes-client";

export const metadata: Metadata = {
  title: "Vistagem — Configurações — ORQESTRAI",
  description: "Regras da Vistagem, o que o admin altera e como a IA funciona.",
  robots: { index: false, follow: false },
};

export default function VistagemConfiguracoesPage() {
  return <ConfiguracoesClient />;
}
