import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseAppSettingsFromMap } from "@/lib/app-settings";

export const dynamic = "force-dynamic";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const accessToken = body.accessToken as string | undefined;
    const refreshToken = body.refreshToken as string | undefined;
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

    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const map = new Map<string, unknown>();
    for (const row of data ?? []) {
      map.set(row.key, row.value);
    }

    const settings = await parseAppSettingsFromMap(map);
    return NextResponse.json(settings);
  } catch {
    return NextResponse.json({ error: "Erro ao processar." }, { status: 500 });
  }
}
