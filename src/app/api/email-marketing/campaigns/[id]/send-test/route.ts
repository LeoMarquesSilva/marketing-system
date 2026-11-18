import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { sendTestEmail, isEmailMarketingConfigured, loadCampaign } from "@/lib/email-marketing-server";
import { sendMailboxTest } from "@/lib/email-marketing-mailbox";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAuthenticatedUser();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const testEmail = (body.email as string | undefined)?.trim();
    if (!testEmail) {
      return NextResponse.json({ error: "Informe um e-mail de teste." }, { status: 400 });
    }
    const campaign = await loadCampaign(id);
    // Campanha pela caixa do sócio: o teste sai da mesma caixa, pela Microsoft.
    if (campaign.send_mode === "mailbox") {
      await sendMailboxTest(id, testEmail);
      return NextResponse.json({ success: true });
    }
    if (!isEmailMarketingConfigured()) {
      return NextResponse.json({ error: "RESEND_API_KEY não configurada." }, { status: 400 });
    }
    await sendTestEmail(id, testEmail);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao enviar e-mail de teste.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
