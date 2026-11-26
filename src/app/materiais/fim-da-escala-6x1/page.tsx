import { prefillFromRecipient } from "@/lib/leads/server";
import { normalizarOrigem } from "@/lib/leads/materiais";
import { Ebook6x1Page } from "@/components/materiais/ebook-6x1-page";

export const dynamic = "force-dynamic";

/**
 * Página pública do e-book "Fim da escala 6x1".
 * - ?r=<destinatário> vem do e-mail da campanha (já sabemos quem é): 5 perguntas liberam o PDF.
 * - Os outros canais (?origem=instagram no Linktree, whatsapp, linkedin…) preenchem nome, WhatsApp, e-mail
 *   e "Você é:", baixam na hora e podem responder as 5 perguntas depois.
 */
export default async function Material6x1({
  searchParams,
}: {
  searchParams: Promise<{ r?: string; origem?: string; utm_source?: string }>;
}) {
  const { r, origem, utm_source } = await searchParams;
  const prefill = await prefillFromRecipient(r).catch(() => null);
  const utm = utm_source?.trim().slice(0, 80) || null;
  return <Ebook6x1Page prefill={prefill} origem={normalizarOrigem(origem, utm)} utm={utm} />;
}
