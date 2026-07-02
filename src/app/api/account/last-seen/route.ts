import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const THROTTLE_MS = 30 * 60 * 1000;

export async function POST() {
  try {
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

    const { data: profile } = await supabase
      .from("users")
      .select("last_seen_at")
      .eq("auth_id", user.id)
      .maybeSingle();

    const now = new Date();
    if (profile?.last_seen_at) {
      const last = new Date(profile.last_seen_at);
      if (now.getTime() - last.getTime() < THROTTLE_MS) {
        return NextResponse.json({ skipped: true, last_seen_at: profile.last_seen_at });
      }
    }

    const iso = now.toISOString();
    const admin = createClient(supabaseUrl, serviceKey);
    const { error } = await admin
      .from("users")
      .update({ last_seen_at: iso })
      .eq("auth_id", user.id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, last_seen_at: iso });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao registrar acesso.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
