import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { runFetchPipeline } from "@/lib/content-roteiros";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

async function ensureAuth(body: Record<string, unknown>): Promise<{ error?: Response }> {
  const accessToken = (body.accessToken ?? body.access_token) as string | undefined;

  if (accessToken) {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: (body.refreshToken ?? body.refresh_token ?? "") as string,
    });
    if (!error && user) return {};
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  }
  return {};
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const auth = await ensureAuth(body);
    if (auth.error) return auth.error;

    const topicIds = body.topicIds as string[] | undefined;
    const monthsBack = typeof body.monthsBack === "number" ? body.monthsBack : undefined;
    const limit = typeof body.limit === "number" ? body.limit : undefined;

    const { created, errors } = await runFetchPipeline(topicIds, undefined, {
      monthsBack,
      limit,
    });

    return NextResponse.json({
      success: true,
      created,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao buscar notícias.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
