import type { Metadata } from "next";
import { CarteiraClient } from "@/components/operacoes-legais/processos/carteira-client";

export const metadata: Metadata = {
  title: "Processos — Carteira Rec. Crédito — ORQESTRAI",
  description: "Carteira de Recuperação de Crédito: crédito atualizado pelo TJSP, citação, pedidos de execução e valor recuperado.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function ProcessosCarteiraPage() {
  return <CarteiraClient />;
}
