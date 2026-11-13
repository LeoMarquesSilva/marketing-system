import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { sincronizarProcessos } from "@/lib/processos/sync-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Traz os processos do VIOS para o cadastro do ORQESTRAI: "Processos Lista" do SharePoint da Controladoria
 * (atualizado ~8h) + processos_completo do SIOE. Roda às 12h UTC (9h em Brasília), depois dos dois.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  try {
    return NextResponse.json(await sincronizarProcessos({ origem: "sharepoint" }));
  } catch (erro) {
    console.error("[cron/processos-sync]", erro instanceof Error ? erro.message : erro);
    return NextResponse.json({ error: "Falha ao sincronizar os processos." }, { status: 500 });
  }
}
