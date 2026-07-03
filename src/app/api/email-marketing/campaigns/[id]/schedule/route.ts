import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { scheduleCampaign, isEmailMarketingConfigured } from "@/lib/email-marketing-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAuthenticatedUser();
    if (!isEmailMarketingConfigured()) {
      return NextResponse.json({ error: "RESEND_API_KEY não configurada." }, { status: 400 });
    }
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const scheduledAt = body.scheduledAt as string | undefined;
    if (!scheduledAt) {
      return NextResponse.json({ error: "Informe a data/hora de agendamento." }, { status: 400 });
    }
    await scheduleCampaign(id, scheduledAt);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao agendar campanha.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
