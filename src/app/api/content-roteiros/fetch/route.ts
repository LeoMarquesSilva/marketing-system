import { after, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { getAuthenticatedContentUser, isContentManager } from "@/lib/content-access";
import { runFetchPipeline } from "@/lib/content-roteiros";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

    const contentUser = await getAuthenticatedContentUser();
    if (!contentUser || !isContentManager(contentUser.profile)) {
      return NextResponse.json(
        { error: "Apenas a equipe de marketing pode buscar notícias." },
        { status: 403 }
      );
    }

    const topicIds = body.topicIds as string[] | undefined;
    const monthsBack = typeof body.monthsBack === "number" ? body.monthsBack : undefined;
    const limit = typeof body.limit === "number" ? body.limit : undefined;
    const sync = body.sync === true;

    const pipelineOptions = {
      monthsBack,
      limit,
      skipOgImage: true,
      maxCreated: sync ? undefined : (topicIds?.length === 1 ? 10 : 8),
    };

    if (sync) {
      const { created, errors, skipped } = await runFetchPipeline(
        topicIds,
        undefined,
        pipelineOptions
      );
      return NextResponse.json({
        success: true,
        created,
        skipped,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    after(async () => {
      try {
        const result = await runFetchPipeline(topicIds, undefined, pipelineOptions);
        console.info("[content-roteiros/fetch] pipeline concluído", {
          created: result.created,
          skipped: result.skipped,
          errors: result.errors.length,
        });
      } catch (err) {
        console.error("[content-roteiros/fetch] pipeline falhou", err);
      }
    });

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
