import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import {
  startCampaignNow,
  sendAllPendingBatches,
  isEmailMarketingConfigured,
} from "@/lib/email-marketing-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Dispara a campanha imediatamente: prepara destinatários e envia lotes em sequência
 * dentro do próprio request (bases pequenas terminam de uma vez). Se o tempo estourar
 * antes de terminar, o cron (/api/cron/email-campaigns) retoma os lotes restantes.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAuthenticatedUser();
    if (!isEmailMarketingConfigured()) {
      return NextResponse.json({ error: "RESEND_API_KEY não configurada." }, { status: 400 });
    }
    const { id } = await context.params;
    const total = await startCampaignNow(id);
    if (total === 0) {
      return NextResponse.json(
        { error: "Nenhum contato inscrito encontrado para esta campanha/lista." },
        { status: 400 }
      );
    }
    const { processed, finished } = await sendAllPendingBatches(id);
    return NextResponse.json({ success: true, totalRecipients: total, processed, finished });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao iniciar envio da campanha.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
