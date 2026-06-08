import { NextResponse } from "next/server";
import { getInternalJobSecret, isAuthorizedInternalJobRequest } from "@/lib/cron-auth";
import { runFetchPipeline } from "@/lib/content-roteiros";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Worker interno — invocado pela rota pública ou cron; não expor ao browser. */
export async function POST(request: Request) {
  if (!isAuthorizedInternalJobRequest(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const topicIds = body.topicIds as string[] | undefined;
    const monthsBack = typeof body.monthsBack === "number" ? body.monthsBack : undefined;
    const limit = typeof body.limit === "number" ? body.limit : undefined;
    const maxCreated =
      typeof body.maxCreated === "number"
        ? body.maxCreated
        : topicIds?.length === 1
          ? 10
          : 8;

    const result = await runFetchPipeline(topicIds, undefined, {
      monthsBack,
      limit,
      skipOgImage: true,
      maxCreated,
    });

    console.info("[content-roteiros/fetch-worker] concluído", {
      created: result.created,
      skipped: result.skipped,
      errors: result.errors.length,
    });

    return NextResponse.json({
      success: true,
      created: result.created,
      skipped: result.skipped,
      errors: result.errors.length > 0 ? result.errors.slice(0, 10) : undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao buscar notícias.";
    console.error("[content-roteiros/fetch-worker]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
