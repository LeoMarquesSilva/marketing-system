import { NextResponse } from "next/server";
import { isAuthorizedInternalJobRequest } from "@/lib/cron-auth";
import { runGustavoContentFetchPipeline } from "@/lib/gustavo-content/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!isAuthorizedInternalJobRequest(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const result = await runGustavoContentFetchPipeline({
      topicIds: Array.isArray(body.topicIds) ? body.topicIds.map(String) : undefined,
      maxCreated: typeof body.maxCreated === "number" ? body.maxCreated : 8,
      trigger: typeof body.trigger === "string" ? body.trigger : "manual",
      fetchArticle: body.fetchArticle === false ? false : true,
      source: body.source === "institutional" ? "institutional" : "rss",
    });

    console.info("[gustavo-content/fetch-worker] concluído", result);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao buscar o radar.";
    console.error("[gustavo-content/fetch-worker]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
