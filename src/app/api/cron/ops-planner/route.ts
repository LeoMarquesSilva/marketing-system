import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runOpsPlannerDaily } from "@/lib/ops-planner/daily-job";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Rodada diária do Planner de Operações Legais: gera as rotinas, grava os avisos
 * e manda o resumo por e-mail. Na Vercel Hobby roda uma vez por dia: 10h UTC
 * (07h em Brasília). ?dryRun=1 mostra o que seria feito sem gravar nem enviar.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  try {
    const result = await runOpsPlannerDaily({ dryRun });
    if (result.emails.failed > 0) {
      console.error("[cron/ops-planner] falhas no e-mail", result.emails);
      return NextResponse.json({ success: false, ...result }, { status: 502 });
    }
    return NextResponse.json({ success: true, ...result, finishedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro na rodada do Planner.";
    console.error("[cron/ops-planner]", message);
    return NextResponse.json({ error: "Não foi possível rodar o Planner de Operações Legais." }, { status: 500 });
  }
}
