import type { Metadata } from "next";
import { PesquisaDetailClient } from "@/components/pesquisas/pesquisa-detail-client";

export const metadata: Metadata = {
  title: "Pesquisa com a equipe — ORQESTRAI",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PesquisaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PesquisaDetailClient id={id} />;
}
