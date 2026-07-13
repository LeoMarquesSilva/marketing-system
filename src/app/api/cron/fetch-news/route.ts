import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runFetchPipeline } from "@/lib/content-roteiros";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Cron diário — executa e aguarda a busca para a Vercel não encerrar o trabalho. */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const result = await runFetchPipeline(undefined, undefined, {
      maxCreated: 10,
      trigger: "cron",
    });

    console.info("[cron/fetch-news] concluído", {
      created: result.created,
      skipped: result.skipped,
      errors: result.errors.length,
    });

    return NextResponse.json({
      success: true,
      created: result.created,
      skipped: result.skipped,
      errors: result.errors.length > 0 ? result.errors.slice(0, 10) : undefined,
      finishedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao buscar notícias.";
    console.error("[cron/fetch-news]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
