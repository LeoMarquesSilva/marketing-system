import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runFetchPipeline } from "@/lib/content-roteiros";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Cron diário — busca notícias de todos os temas ativos e gera os posts. */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const { created, skipped, errors } = await runFetchPipeline(undefined, undefined, {
      skipOgImage: true,
      maxCreated: 30,
    });
    return NextResponse.json({
      success: true,
      created,
      skipped,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      finishedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao buscar notícias.";
    console.error("[cron/fetch-news]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
