import { NextResponse } from "next/server";
import { processEvolutionWebhookRequest } from "@/lib/evolution-whatsapp";

export const dynamic = "force-dynamic";

/** Webhook por evento (webhookByEvents=true): /api/evolution/webhook/messages-upsert */
export async function POST(
  request: Request,
  context: { params: Promise<{ slug?: string[] }> }
) {
  const { slug } = await context.params;
  const pathEvent = slug?.join("/");
  return processEvolutionWebhookRequest(request, pathEvent);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug?: string[] }> }
) {
  const { slug } = await context.params;
  const hasSecret = Boolean(process.env.EVOLUTION_WEBHOOK_SECRET?.trim());
  return NextResponse.json({
    ok: true,
    endpoint: `/api/evolution/webhook/${slug?.join("/") ?? ""}`,
    method: "POST",
    pathEvent: slug?.join("/") ?? null,
    secretConfigured: hasSecret,
  });
}
