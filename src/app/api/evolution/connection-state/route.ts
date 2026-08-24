import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";

/**
 * Estado de conexão da instância Evolution — qualquer pessoa que usa o inbox
 * precisa saber se o WhatsApp caiu, não só admin (por isso não é gated).
 */
export async function GET() {
  try {
    await requireAuthenticatedUser();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from("whatsapp_instance_status")
      .select("instance_name, state, status_reason, last_connected_at, last_disconnected_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return NextResponse.json({ status: data ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao verificar conexão.";
    const status = message.includes("Não autenticado") || message.includes("inativo") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
