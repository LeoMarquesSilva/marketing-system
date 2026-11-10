import type { Metadata } from "next";
import { VotingClient } from "@/components/rh/bp-awards/voting/voting-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "BP Awards · 10 anos | Bismarchi | Pires",
  description: "Premiação CIVIL: indique quem representa os valores do Bismarchi | Pires.",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

/** Votação do BP Awards pelo colaborador (login exigido pelo proxy e pelo AuthGuard). ?previa=1: revisão do RH. */
export default async function BpAwardsPage({
  searchParams,
}: {
  searchParams: Promise<{ previa?: string; hub?: string }>;
}) {
  const params = await searchParams;
  return <VotingClient preview={params.previa === "1"} previewAs={params.hub ?? null} />;
}
