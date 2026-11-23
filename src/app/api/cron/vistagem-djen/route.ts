import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { sincronizarDjen } from "@/lib/vistagem/djen-kurier-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Conferência DJEN × Kurier: busca no DJEN as comunicações de ontem e de hoje do Gustavo e do Ricardo. Na Vercel
 * Hobby cada cron roda uma vez por dia: 11h UTC (8h em Brasília, depois da Kurier) e 23h UTC (20h, para fechar o dia).
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  try {
    const resultado = await sincronizarDjen("cron");
    if (resultado.erro) {
      console.error("[cron/vistagem-djen]", resultado.erro);
      return NextResponse.json({ success: false, ...resultado }, { status: 502 });
    }
    return NextResponse.json({ success: true, ...resultado, finishedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar no DJEN.";
    console.error("[cron/vistagem-djen]", message);
    return NextResponse.json({ error: "Não foi possível buscar no DJEN." }, { status: 500 });
  }
}
