import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { rodarRotina } from "@/lib/audiencias/rotina-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Rotina da Pauta de Audiências: conferência com o VIOS (quando há leitura nova do PJe), DJEN, convites do Outlook,
 * respostas e avisos do horário (7h, 17h, alertas).
 * A Vercel (plano Hobby) chama uma vez por dia; o pg_cron chama a cada 10 minutos com o mesmo CRON_SECRET.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try {
    return NextResponse.json({ success: true, ...(await rodarRotina()), finishedAt: new Date().toISOString() });
  } catch (error) {
    console.error("[cron/pauta-tick]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Não foi possível rodar a rotina da pauta." }, { status: 500 });
  }
}
