import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  isEvolutionConfigured,
  requireEvolutionAdmin,
  syncEvolutionMessages,
} from "@/lib/evolution-whatsapp";

export const dynamic = "force-dynamic";

/** Puxa mensagens recentes da Evolution API para o Supabase (não altera webhook). */
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
        {
          error:
            "Evolution API não configurada. Defina EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE.",
        },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const limit =
      typeof (body as { limit?: unknown }).limit === "number"
        ? (body as { limit: number }).limit
        : 200;

    const result = await syncEvolutionMessages({ limit });

    return NextResponse.json({
      ok: true,
      ...result,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao sincronizar.";
    console.error("[evolution/sync]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
