import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runGustavoContentFetchPipeline } from "@/lib/gustavo-content/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Cron em dia útil — isolado do pipeline institucional de /conteudo/roteiros. */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const result = await runGustavoContentFetchPipeline({
      maxCreated: 8,
      trigger: "cron",
    });
    console.info("[cron/gustavo-content-fetch] concluído", result);
    return NextResponse.json({ success: true, ...result, finishedAt: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro no radar do Gustavo.";
    console.error("[cron/gustavo-content-fetch]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
