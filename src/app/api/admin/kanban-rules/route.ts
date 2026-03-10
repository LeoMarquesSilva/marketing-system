import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { KanbanVisibility, StageMoveRules } from "@/lib/app-settings";

export const dynamic = "force-dynamic";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const kanbanVisibility = body.kanbanVisibility as KanbanVisibility | undefined;
    const stageMoveRules = body.stageMoveRules as StageMoveRules | undefined;
    const accessToken = body.accessToken as string | undefined;
    const refreshToken = body.refreshToken as string | undefined;

    if (
      !kanbanVisibility ||
      (kanbanVisibility !== "designer_own_admin_all" && kanbanVisibility !== "everyone_all")
    ) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }
    if (!stageMoveRules || typeof stageMoveRules !== "object") {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }
    if (!accessToken) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken ?? "",
    });
    if (sessionError || !user) {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .single();

    const role = (profile?.role as string | null)?.toLowerCase?.();
    if (role !== "admin") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const { error: err1 } = await supabase
      .from("app_settings")
      .upsert(
        { key: "kanban_visibility", value: kanbanVisibility, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
    if (err1) {
      return NextResponse.json({ error: err1.message }, { status: 500 });
    }

    const { error: err2 } = await supabase
      .from("app_settings")
      .upsert(
        { key: "stage_move_rules", value: stageMoveRules, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
    if (err2) {
      return NextResponse.json({ error: err2.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erro ao processar." }, { status: 500 });
  }
}
