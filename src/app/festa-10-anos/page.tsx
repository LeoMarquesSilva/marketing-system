import type { Metadata } from "next";
import { ConfirmarPresencaClient } from "@/components/festa-10-anos/confirmar-presenca-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirme sua presença · 10 anos | Bismarchi | Pires",
  description: "Festa de 10 anos do escritório: confirme sua presença e se vai usar o micro-ônibus.",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

/** Confirmação da equipe (login exigido pelo proxy e pelo AuthGuard). ?previa=1: vê o formulário sem gravar. */
export default async function Festa10AnosPage({ searchParams }: { searchParams: Promise<{ previa?: string }> }) {
  const query = await searchParams;
  return <ConfirmarPresencaClient preview={query.previa === "1"} />;
}
