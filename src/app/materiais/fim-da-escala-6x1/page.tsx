import { prefillFromRecipient } from "@/lib/leads/server";
import { Ebook6x1Page } from "@/components/materiais/ebook-6x1-page";

export const dynamic = "force-dynamic";

/**
 * Página pública do e-book "Fim da escala 6x1": 5 perguntas de qualificação liberam o PDF.
 * ?r=<destinatário> vem do e-mail da campanha (já sabemos quem é); ?origem=whatsapp marca o canal.
 */
export default async function Material6x1({
  searchParams,
}: {
  searchParams: Promise<{ r?: string; origem?: string }>;
}) {
  const { r, origem } = await searchParams;
  const prefill = await prefillFromRecipient(r).catch(() => null);
  return <Ebook6x1Page prefill={prefill} origem={origem === "whatsapp" ? "whatsapp" : null} />;
}
