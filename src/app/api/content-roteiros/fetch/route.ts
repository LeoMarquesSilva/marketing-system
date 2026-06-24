import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { getAuthenticatedContentUser, isContentManager } from "@/lib/content-access";
import { getInternalJobSecret } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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

function resolveWorkerBaseUrl(request: Request): string {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return new URL(request.url).origin;
}

function triggerFetchWorker(
  request: Request,
  payload: Record<string, unknown>
): void {
  const secret = getInternalJobSecret();
  if (!secret) {
    console.error("[content-roteiros/fetch] nenhum segredo interno disponível");
    return;
  }

  const url = `${resolveWorkerBaseUrl(request)}/api/content-roteiros/fetch-worker`;
  void fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(payload),
  }).catch((err) => {
    console.error("[content-roteiros/fetch] falha ao disparar worker", err);
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const auth = await ensureAuth(body);
    if (auth.error) return auth.error;

    const contentUser = await getAuthenticatedContentUser();
    if (!contentUser || !isContentManager(contentUser.profile)) {
      return NextResponse.json(
        { error: "Apenas a equipe de marketing pode buscar notícias." },
        { status: 403 }
      );
    }

    const secret = getInternalJobSecret();
    if (!secret) {
      return NextResponse.json(
        { error: "Segredo interno do servidor não configurado." },
        { status: 503 }
      );
    }

    const topicIds = body.topicIds as string[] | undefined;
    const monthsBack = typeof body.monthsBack === "number" ? body.monthsBack : undefined;
    const limit = typeof body.limit === "number" ? body.limit : undefined;

    triggerFetchWorker(request, { topicIds, monthsBack, limit, trigger: "manual" });

    return NextResponse.json(
      {
        started: true,
        message:
          "Busca iniciada em segundo plano. Os conteúdos aparecerão em Conteúdo para Post em alguns minutos.",
      },
      { status: 202 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao buscar notícias.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
