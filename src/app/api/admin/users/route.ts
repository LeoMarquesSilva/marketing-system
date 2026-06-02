import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const DEFAULT_PASSWORD = "123456";

function admin() {
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  return createClient(supabaseUrl, serviceKey);
}

async function ensureAdmin(): Promise<{ error?: Response }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  }
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("auth_id", user.id)
    .maybeSingle();
  if ((profile?.role as string | null)?.toLowerCase?.() !== "admin") {
    return { error: NextResponse.json({ error: "Acesso negado." }, { status: 403 }) };
  }
  return {};
}

export async function POST(request: Request) {
  try {
    const auth = await ensureAdmin();
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const { action, userId } = body as { action?: string; userId?: string };
    if (!userId) {
      return NextResponse.json({ error: "userId é obrigatório." }, { status: 400 });
    }

    const db = admin();
    const { data: u, error: uErr } = await db
      .from("users")
      .select("id, name, email, auth_id")
      .eq("id", userId)
      .single();
    if (uErr || !u) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    if (action === "activate") {
      const email = ((body.email as string | undefined) ?? u.email ?? "").trim();
      if (!email) {
        return NextResponse.json(
          { error: "E-mail é obrigatório para ativar o acesso." },
          { status: 400 }
        );
      }

      if (u.auth_id) {
        // Já tem login: redefine para a senha padrão e força troca.
        const { error: updErr } = await db.auth.admin.updateUserById(u.auth_id, {
          password: DEFAULT_PASSWORD,
        });
        if (updErr) throw new Error(updErr.message);
        await db
          .from("users")
          .update({ email, is_active: true, must_change_password: true })
          .eq("id", userId);
        return NextResponse.json({ success: true, reset: true, auth_id: u.auth_id });
      }

      // Cria o login no Supabase Auth.
      const { data: created, error: createErr } = await db.auth.admin.createUser({
        email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
      });
      if (createErr || !created.user) {
        throw new Error(createErr?.message ?? "Falha ao criar o login.");
      }
      const { error: linkErr } = await db
        .from("users")
        .update({
          auth_id: created.user.id,
          email,
          is_active: true,
          must_change_password: true,
        })
        .eq("id", userId);
      if (linkErr) throw new Error(linkErr.message);
      return NextResponse.json({ success: true, created: true, auth_id: created.user.id });
    }

    if (action === "set_access") {
      const permissions = Array.isArray(body.permissions)
        ? (body.permissions as string[])
        : null;
      const { error } = await db
        .from("users")
        .update({ permissions })
        .eq("id", userId);
      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro na operação.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
