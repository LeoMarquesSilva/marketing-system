import { NextResponse } from "next/server";
import { processEvolutionWebhookRequest } from "@/lib/evolution-whatsapp";

export const dynamic = "force-dynamic";

/**
 * Webhook Evolution API (doc v2):
 * POST /webhook/set/{instance} com events MESSAGES_UPSERT, SEND_MESSAGE, MESSAGES_UPDATE
 * URL: https://SEU-DOMINIO/api/evolution/webhook
 * Com webhookByEvents=true: .../api/evolution/webhook/messages-upsert
 */
export async function POST(request: Request) {
  return processEvolutionWebhookRequest(request);
}

export async function GET() {
  const hasSecret = Boolean(process.env.EVOLUTION_WEBHOOK_SECRET?.trim());
  return NextResponse.json({
    ok: true,
    endpoint: "/api/evolution/webhook",
    method: "POST",
    events: ["MESSAGES_UPSERT", "SEND_MESSAGE", "MESSAGES_UPDATE"],
    secretConfigured: hasSecret,
    warning:
      !hasSecret && process.env.NODE_ENV === "production"
        ? "EVOLUTION_WEBHOOK_SECRET ausente em produção. O endpoint irá rejeitar requisições."
        : null,
    docs: "https://doc.evolution-api.com/v2/en/configuration/webhooks",
  });
}
