import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  EVOLUTION_MESSAGE_EVENTS,
  fetchEvolutionWebhookConfig,
  getEvolutionConfig,
  getEvolutionWebhookReceiveUrl,
  getMarketingPublicUrl,
  getSupabaseEvolutionWebhookUrl,
  isEvolutionConfigured,
} from "@/lib/evolution-whatsapp";
import { requireAdminUser } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

function webhookPointsToApp(url: string): boolean {
  return url.includes("/functions/v1/evolution-webhook");
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    await requireAdminUser(user.id);

    const config = getEvolutionConfig();
    const webhook = await fetchEvolutionWebhookConfig().catch(() => null);
    const supabaseWebhookUrl = getSupabaseEvolutionWebhookUrl();
    const marketingPublicUrl = getMarketingPublicUrl();
    const targetWebhookUrl = getEvolutionWebhookReceiveUrl();

    const webhookPointsToAppFlag = webhook?.url
      ? webhookPointsToApp(webhook.url)
      : false;

    const messageEventsConfigured =
      webhook?.events.some((e) =>
        (EVOLUTION_MESSAGE_EVENTS as readonly string[]).includes(
          e.toUpperCase().replace(/\./g, "_")
        )
      ) ?? false;

    return NextResponse.json({
      configured: isEvolutionConfigured(),
      instance: config?.instanceName ?? null,
      evolutionBaseUrl: config?.baseUrl ?? null,
      marketingPublicUrl,
      supabaseWebhookUrl,
      targetWebhookUrl,
      preferredTarget: "supabase",
      webhook: webhook
        ? {
            enabled: webhook.enabled,
            url: webhook.url,
            webhookByEvents: webhook.webhookByEvents,
            events: webhook.events,
            pointsToApp: webhookPointsToAppFlag,
            messageEventsConfigured,
          }
        : null,
      realtime: {
        channel: "supabase_realtime",
        tables: ["whatsapp_conversations", "whatsapp_messages"],
        flow: "Evolution → Supabase Edge Function → Postgres → Realtime → Inbox",
      },
      recommendations: webhookPointsToAppFlag
        ? []
        : [
            supabaseWebhookUrl
              ? `Aponte a instância BP para ${supabaseWebhookUrl} — grava direto no Supabase (Edge Function).`
              : "Configure NEXT_PUBLIC_SUPABASE_URL para habilitar o webhook.",
            "A Evolution aceita apenas 1 webhook por instância.",
            "Enquanto não configurar, use Sincronizar Evolution na UI.",
          ],
      docs: {
        webhooks: "https://doc.evolution-api.com/v2/en/configuration/webhooks",
        edgeFunctions: "https://supabase.com/docs/guides/functions",
      },
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    if (
      err instanceof Error &&
      err.message === "Apenas administradores podem executar esta ação."
    ) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    const msg = err instanceof Error ? err.message : "Erro ao verificar status.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
