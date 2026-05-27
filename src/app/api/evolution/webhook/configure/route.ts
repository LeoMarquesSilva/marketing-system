import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  configureEvolutionMarketingWebhook,
  isEvolutionConfigured,
  requireEvolutionAdmin,
} from "@/lib/evolution-whatsapp";

export const dynamic = "force-dynamic";

/**
 * Aponta o webhook da instância Evolution (BP) direto para este app.
 * A Evolution aceita apenas 1 URL — substitui o destino atual.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    try {
      await requireEvolutionAdmin(user.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sem permissão.";
      return NextResponse.json({ error: msg }, { status: 403 });
    }

    if (!isEvolutionConfigured()) {
      return NextResponse.json(
        { error: "Evolution API não configurada." },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const webhookUrlOverride =
      typeof (body as { webhookUrl?: unknown }).webhookUrl === "string"
        ? (body as { webhookUrl: string }).webhookUrl
        : undefined;

    const result = await configureEvolutionMarketingWebhook(webhookUrlOverride);

    return NextResponse.json({
      ok: true,
      ...result,
      note:
        "A Evolution usa uma única URL de webhook por instância. O destino anterior foi substituído.",
      configuredAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao configurar webhook.";
    console.error("[evolution/webhook/configure]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
