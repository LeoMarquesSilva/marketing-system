import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { descartarVencidos } from "@/lib/processos/autos-server";
import { sincronizarPessoasComVios } from "@/lib/processos/pessoas-sync-server";
import { sincronizarProcessos } from "@/lib/processos/sync-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Traz os processos do VIOS para o cadastro do ORQESTRAI: "Processos Lista" do SharePoint da Controladoria
 * (atualizado ~8h) + processos_completo do SIOE, e em seguida as pessoas (Cadastros > Pessoas, pelo SIOE).
 * Roda às 12h UTC (9h em Brasília), depois dos dois.
 * Na mesma passada, exclui os PDFs de autos com o prazo de guarda vencido.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const autos = await descartarVencidos().catch((erro) => {
    console.error("[cron/processos-sync] descarte dos PDFs:", erro instanceof Error ? erro.message : erro);
    return null;
  });
  try {
    const processos = await sincronizarProcessos({ origem: "sharepoint" });
    // As partes novas nascem só com o nome: a carga de pessoas liga ao VIOS e junta com quem já existe.
    const pessoas = await sincronizarPessoasComVios().catch((erro: unknown) => ({ erro: erro instanceof Error ? erro.message : String(erro) }));
    return NextResponse.json({ processos, pessoas, autos });
  } catch (erro) {
    console.error("[cron/processos-sync]", erro instanceof Error ? erro.message : erro);
    return NextResponse.json({ error: "Falha ao sincronizar os processos." }, { status: 500 });
  }
}
