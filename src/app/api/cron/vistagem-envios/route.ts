import { NextResponse } from "next/server";
import { autorizadoNosEnvios } from "@/lib/vistagem/envios-auth";
import { atualizarEnvios } from "@/lib/vistagem/juridico-server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Lê na fila do SAMA o andamento das tarefas enviadas ao robô e avisa no WhatsApp de Operações Legais os erros novos.
 * Quem chama é o pg_cron do SAMA (job "orquestra-envios", a cada 3 minutos e só quando a fila mexeu), porque a
 * Vercel Hobby só agenda uma vez por dia. `?ping` só confere a chave, sem ler nada.
 */
export async function GET(request: Request) {
  if (!autorizadoNosEnvios(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (new URL(request.url).searchParams.has("ping")) return NextResponse.json({ success: true, ping: true });
  try {
    return NextResponse.json({ success: true, ...(await atualizarEnvios()), finishedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cron/vistagem-envios]", message);
    return NextResponse.json({ error: "Não foi possível ler os envios do robô." }, { status: 500 });
  }
}
