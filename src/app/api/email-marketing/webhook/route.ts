import { NextResponse } from "next/server";
import { verifyResendWebhook, handleResendWebhookEvent } from "@/lib/email-marketing-server";

export const dynamic = "force-dynamic";

/** Webhook do Resend: email.delivered / opened / clicked / bounced / complained / failed. */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const event = verifyResendWebhook(rawBody, request.headers);
    await handleResendWebhookEvent(event);
    return NextResponse.json({ received: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao processar webhook.";
    console.error("[email-marketing/webhook]", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/email-marketing/webhook",
    method: "POST",
    secretConfigured: Boolean(process.env.RESEND_WEBHOOK_SECRET?.trim()),
  });
}
