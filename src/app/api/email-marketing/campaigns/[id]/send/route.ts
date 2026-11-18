import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import {
  startCampaignNow,
  sendAllPendingBatches,
  isEmailMarketingConfigured,
  loadCampaign,
} from "@/lib/email-marketing-server";
import { advanceBroadcastCampaign } from "@/lib/email-marketing-broadcast";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Dispara (ou agenda, com `scheduledAt`) a campanha.
 * Broadcast (padrão): cada chamada põe uma leva de destinatários no segmento do Resend e devolve
 * o progresso; a tela chama de novo enquanto `phase` for "syncing". Ao terminar, o broadcast sai.
 * Lotes (legado): envia em lotes transacionais até o tempo acabar; o cron retoma o resto.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAuthenticatedUser();
    if (!isEmailMarketingConfigured()) {
      return NextResponse.json({ error: "RESEND_API_KEY não configurada." }, { status: 400 });
    }
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { scheduledAt?: string | null };
    const campaign = await loadCampaign(id);

    if (campaign.send_mode === "broadcast") {
      const progress = await advanceBroadcastCampaign(id, { scheduledAt: body.scheduledAt ?? null });
      return NextResponse.json({ success: true, mode: "broadcast", ...progress });
    }

    const total = await startCampaignNow(id);
    if (total === 0) {
      return NextResponse.json(
        { error: "Nenhum contato inscrito encontrado para esta campanha/lista." },
        { status: 400 }
      );
    }
    const { processed, finished } = await sendAllPendingBatches(id);
    return NextResponse.json({ success: true, mode: "batch", totalRecipients: total, processed, finished });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao iniciar envio da campanha.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
