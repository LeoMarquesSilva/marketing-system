import { CertificadosClient } from "@/components/certificados/certificados-client";

export const dynamic = "force-dynamic";

export default async function CertificadosPage({
  searchParams,
}: {
  searchParams: Promise<{ card?: string | string[] }>;
}) {
  const { card } = await searchParams;
  const cardId = (Array.isArray(card) ? card[0] : card)?.trim() || null;
  return <CertificadosClient key={cardId ?? "rascunho"} cardId={cardId} />;
}
