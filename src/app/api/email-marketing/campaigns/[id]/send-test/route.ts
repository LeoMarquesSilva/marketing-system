import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { sendTestEmail, isEmailMarketingConfigured } from "@/lib/email-marketing-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAuthenticatedUser();
    if (!isEmailMarketingConfigured()) {
      return NextResponse.json({ error: "RESEND_API_KEY não configurada." }, { status: 400 });
    }
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const testEmail = (body.email as string | undefined)?.trim();
    if (!testEmail) {
      return NextResponse.json({ error: "Informe um e-mail de teste." }, { status: 400 });
    }
    await sendTestEmail(id, testEmail);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao enviar e-mail de teste.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
