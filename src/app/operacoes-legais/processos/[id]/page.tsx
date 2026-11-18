import type { Metadata } from "next";
import { FichaClient } from "@/components/operacoes-legais/processos/ficha-client";

export const metadata: Metadata = {
  title: "Processo — ORQESTRAI",
  description: "Ficha do processo: cadastro, partes, saneamento e histórico.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ProcessoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FichaClient id={id} />;
}
