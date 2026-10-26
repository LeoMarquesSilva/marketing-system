import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { resolveStaleWhatsappConversations } from "@/lib/whatsapp-attendance";

export const dynamic = "force-dynamic";

const MIN_DAYS = 7;

/** Resolve de uma vez as conversas sem mensagem há mais de N dias (padrão 30). */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { days?: unknown };
    const days = Math.floor(Number(body.days ?? 30));
    if (!Number.isFinite(days) || days < MIN_DAYS) {
      return NextResponse.json(
        { error: `Informe ao menos ${MIN_DAYS} dias.` },
        { status: 400 }
      );
    }

    const resolved = await resolveStaleWhatsappConversations(days);
    return NextResponse.json({ ok: true, resolved });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao resolver conversas paradas.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
