import type { Metadata } from "next";
import { ResponderClient } from "@/components/pesquisas/responder-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pesquisa com a equipe | Bismarchi | Pires",
  description: "Sua resposta ajuda a planejar o próximo ano da equipe.",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

/** Resposta do colaborador (login exigido pelo proxy e pelo AuthGuard). ?previa=1: quem gerencia vê sem gravar. */
export default async function ResponderPesquisaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ previa?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  return <ResponderClient slug={slug} preview={query.previa === "1"} />;
}
