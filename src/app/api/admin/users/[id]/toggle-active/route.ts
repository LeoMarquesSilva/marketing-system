import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminUser, requireAuthenticatedUser } from "@/lib/api-auth";

const USER_SELECT = "id, name, email, department, avatar_url, is_active";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireAuthenticatedUser();
    await requireAdminUser(authUser.id);

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) throw new Error("Service role não configurada.");
    const db = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { id } = await context.params;
    const { data: current, error: readError } = await db
      .from("users")
      .select("is_active")
      .eq("id", id)
      .single();
    if (readError || !current) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    const { data, error } = await db
      .from("users")
      .update({ is_active: !(current.is_active ?? true) })
      .eq("id", id)
      .select(USER_SELECT)
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ user: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao alterar usuário.";
    const status =
      message === "Não autenticado."
        ? 401
        : message.includes("administradores") || message === "Usuário inativo."
          ? 403
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
