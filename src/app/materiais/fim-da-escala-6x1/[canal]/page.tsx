import { notFound } from "next/navigation";
import { normalizarOrigem, type Origem } from "@/lib/leads/materiais";
import { Ebook6x1Page } from "@/components/materiais/ebook-6x1-page";

export const dynamic = "force-dynamic";

/** Canais com link próprio e limpo (sem ?origem=): /materiais/fim-da-escala-6x1/instagram, /whatsapp… */
const CANAIS: Origem[] = ["instagram", "whatsapp", "linkedin", "site"];

export default async function Material6x1PorCanal({
  params,
  searchParams,
}: {
  params: Promise<{ canal: string }>;
  searchParams: Promise<{ utm_source?: string }>;
}) {
  const { canal } = await params;
  if (!CANAIS.includes(canal as Origem)) notFound();
  const { utm_source } = await searchParams;
  const utm = utm_source?.trim().slice(0, 80) || null;
  return <Ebook6x1Page prefill={null} origem={normalizarOrigem(canal, utm)} utm={utm} />;
}
