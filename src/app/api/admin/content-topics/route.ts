import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import {
  fetchContentTopics,
  createContentTopic,
  updateContentTopic,
  deleteContentTopic,
} from "@/lib/content-topics";

export const dynamic = "force-dynamic";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

async function ensureAdminFromSession(): Promise<{ error?: Response }> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  }
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("auth_id", user.id)
    .single();
  const role = (profile?.role as string | null)?.toLowerCase?.();
  if (role !== "admin") {
    return { error: NextResponse.json({ error: "Acesso negado." }, { status: 403 }) };
  }
  return {};
}

async function ensureAdminFromBody(
  body: Record<string, unknown>
): Promise<{ error?: Response }> {
  const accessToken = (body.accessToken ?? body.access_token) as string | undefined;
  if (!accessToken) {
    return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: (body.refreshToken ?? body.refresh_token ?? "") as string,
  });
  if (sessionError || !user) {
    return { error: NextResponse.json({ error: "Sessão inválida." }, { status: 401 }) };
  }
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("auth_id", user.id)
    .single();
  const role = (profile?.role as string | null)?.toLowerCase?.();
  if (role !== "admin") {
    return { error: NextResponse.json({ error: "Acesso negado." }, { status: 403 }) };
  }
  return {};
}

export async function GET(request: Request) {
  try {
    const auth = await ensureAdminFromSession();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    const topics = await fetchContentTopics(includeInactive);
    return NextResponse.json(topics);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao listar temas.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const auth = await ensureAdminFromBody(body);
    if (auth.error) return auth.error;
    const { name, rss_query, legal_area, is_active, months_back, item_limit, action } = body;

    if (action === "list") {
      const includeInactive = body.includeInactive === true;
      const topics = await fetchContentTopics(includeInactive);
      return NextResponse.json(topics);
    }

    if (!name || !rss_query || !legal_area) {
      return NextResponse.json(
        { error: "name, rss_query e legal_area são obrigatórios." },
        { status: 400 }
      );
    }

    const topic = await createContentTopic({
      name,
      rss_query,
      legal_area,
      is_active,
      months_back: typeof months_back === "number" ? months_back : undefined,
      item_limit: typeof item_limit === "number" ? item_limit : undefined,
    });
    return NextResponse.json(topic);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao criar tema.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const auth = await ensureAdminFromBody(body);
    if (auth.error) return auth.error;
    const { id, accessToken, refreshToken, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });
    }

    const topic = await updateContentTopic(id, updates);
    return NextResponse.json(topic);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao atualizar tema.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const auth = await ensureAdminFromBody(body);
    if (auth.error) return auth.error;
    const id = body.id as string | undefined;

    if (!id) {
      return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });
    }

    await deleteContentTopic(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao excluir tema.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
