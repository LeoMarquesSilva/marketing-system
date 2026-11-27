import type { Metadata } from "next";
import { CarteiraTrabalhistaClient } from "@/components/operacoes-legais/processos/carteira-trabalhista-client";

export const metadata: Metadata = {
  title: "Processos — Carteira Trabalhista — ORQESTRAI",
  description: "Carteira Trabalhista: saneamento, risco, atualização dos autos e a tentativa de acordo de cada processo.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ProcessosTrabalhistaPage({ searchParams }: { searchParams: Promise<{ aba?: string | string[] }> }) {
  const { aba } = await searchParams;
  return <CarteiraTrabalhistaClient aba={aba === "acordos" ? "acordos" : "carteira"} />;
}
