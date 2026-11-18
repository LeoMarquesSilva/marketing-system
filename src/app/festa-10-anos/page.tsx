import type { Metadata } from "next";
import { ConfirmarPresencaClient } from "@/components/festa-10-anos/confirmar-presenca-client";

export const dynamic = "force-dynamic";

const PAGE_TITLE = "Confirme sua presença · 10 anos | Bismarchi | Pires";
const PAGE_DESCRIPTION =
  "Festa de 10 anos do escritório: 17/12, às 18h, na Fazenda Santa Margarida. Confirme sua presença e diga se vai precisar do micro-ônibus.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  // Prévia do link no WhatsApp (a imagem é o opengraph-image.jpg desta pasta).
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/festa-10-anos",
    siteName: "Bismarchi | Pires",
    locale: "pt_BR",
    type: "website",
  },
};

/**
 * Confirmação da equipe (login exigido pelo AuthGuard e pela API). ?previa=1: vê o formulário sem gravar;
 * com &acompanhante=1, a prévia mostra também a pergunta do acompanhante (dos sócios de área).
 */
export default async function Festa10AnosPage({ searchParams }: { searchParams: Promise<{ previa?: string; acompanhante?: string }> }) {
  const query = await searchParams;
  const preview = query.previa === "1";
  return <ConfirmarPresencaClient preview={preview} previewCompanion={preview && query.acompanhante === "1"} />;
}
