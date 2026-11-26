import { NextResponse } from "next/server";
import { avisarLembretes } from "@/lib/audiencias/avisos-server";
import { rodarRotina } from "@/lib/audiencias/rotina-server";
import { autorizadoNosEnvios } from "@/lib/vistagem/envios-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Rotina da Pauta de Audiências: conferência com o VIOS (quando há leitura nova do PJe), DJEN, convites do Outlook,
 * respostas e avisos do horário (7h–9h pauta do dia, 17h–19h pauta do próximo dia útil, alertas das 7h às 19h).
 * Quem chama: a Vercel (plano Hobby) uma vez por dia, às 8h, e o pg_cron do SAMA (job "orquestra-pauta") nos horários
 * dos avisos, 7h e 17h dos dias úteis, com a mesma chave derivada da rota dos envios. `?ping` só confere a chave.
 * `?lembretes` só manda os lembretes de 30 minutos antes (job "orquestra-pauta-lembretes", de 5 em 5 minutos): uma
 * consulta curta, sem DJEN, VIOS nem Outlook.
 */
export async function GET(request: Request) {
  if (!autorizadoNosEnvios(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const parametros = new URL(request.url).searchParams;
  if (parametros.has("ping")) return NextResponse.json({ success: true, ping: true });
  try {
    if (parametros.has("lembretes")) return NextResponse.json({ success: true, lembretes: await avisarLembretes() });
    return NextResponse.json({ success: true, ...(await rodarRotina()), finishedAt: new Date().toISOString() });
  } catch (error) {
    console.error("[cron/pauta-tick]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Não foi possível rodar a rotina da pauta." }, { status: 500 });
  }
}
