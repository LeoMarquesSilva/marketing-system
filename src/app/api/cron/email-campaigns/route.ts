import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { processScheduledEmailCampaigns, isEmailMarketingConfigured } from "@/lib/email-marketing-server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Cron — promove campanhas agendadas e envia lotes de campanhas em andamento. */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!isEmailMarketingConfigured()) {
    return NextResponse.json({ success: true, skipped: "RESEND_API_KEY não configurada." });
  }

  try {
    const result = await processScheduledEmailCampaigns();
    return NextResponse.json({ success: true, ...result, finishedAt: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao processar campanhas de e-mail.";
    console.error("[cron/email-campaigns]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
