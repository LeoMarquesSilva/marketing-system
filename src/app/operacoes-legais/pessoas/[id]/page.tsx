import type { Metadata } from "next";
import { PessoaClient } from "@/components/operacoes-legais/pessoas/pessoa-client";

export const metadata: Metadata = {
  title: "Pessoa — ORQESTRAI",
  description: "Ficha da pessoa: dados, contatos, vínculos e processos.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PessoaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PessoaClient id={id} />;
}
