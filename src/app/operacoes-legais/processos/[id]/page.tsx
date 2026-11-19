import type { Metadata } from "next";
import { FichaClient } from "@/components/operacoes-legais/processos/ficha-client";

export const metadata: Metadata = {
  title: "Processo — ORQESTRAI",
  description: "Ficha do processo: cadastro, partes, saneamento e histórico.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ProcessoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ de?: string | string[] }> }) {
  const [{ id }, { de }] = await Promise.all([params, searchParams]);
  return <FichaClient id={id} de={typeof de === "string" ? de : null} />;
}
