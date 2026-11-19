import type { Metadata } from "next";
import { DegustacaoClient } from "@/components/eventos/degustacao/degustacao-client";

export const metadata: Metadata = {
  title: "Degustação de drinks · ORQESTRAI",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

/** Votação da degustação no celular (fora do menu, com login): foto e nome do drink, nota de 1 a 5 de cada participante e a tabela ao vivo. */
export default async function DegustacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DegustacaoClient tastingId={id} />;
}
