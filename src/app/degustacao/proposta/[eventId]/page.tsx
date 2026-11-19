import type { Metadata } from "next";
import { PropostaClient } from "@/components/eventos/degustacao/proposta-client";

export const metadata: Metadata = {
  title: "Escolha dos drinks · ORQESTRAI",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

/** Proposta dos drinks da festa para quem decide (com login): degustações comparadas e a escolha salva na hora. */
export default async function PropostaDrinksPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <PropostaClient eventId={eventId} />;
}
