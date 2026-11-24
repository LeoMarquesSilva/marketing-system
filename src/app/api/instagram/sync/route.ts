import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { runInstagramSync } from "@/lib/instagram-sync-job";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Botão "Atualizar agora": roda a mesma coleta diária do cron, no servidor, numa chamada só. */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const result = await runInstagramSync("daily", { trigger: "button" });
    revalidatePath("/instagram-insights");
    revalidatePath("/metricas");
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao sincronizar Instagram.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
