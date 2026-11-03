import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export async function POST(request: Request) {
  try {
    // Recuperação pelo "Esqueci minha senha": só libera a senha, sem reabrir o tutorial do primeiro acesso.
    const body = (await request.json().catch(() => null)) as { recovery?: unknown } | null;
    const isRecovery = body?.recovery === true;
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (!serviceKey) {
      return NextResponse.json({ error: "Service role não configurada." }, { status: 500 });
    }
    const admin = createClient(supabaseUrl, serviceKey);
    const { error } = await admin
      .from("users")
      .update(
        isRecovery
          ? { must_change_password: false }
          : { must_change_password: false, content_tutorial_completed_at: null }
      )
      .eq("auth_id", user.id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao concluir troca de senha.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
