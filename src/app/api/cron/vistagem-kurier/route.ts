import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { alertarArquivoAtrasado, situacaoArquivoDoDia } from "@/lib/vistagem/alerta-arquivo-server";
import { atualizarEnvios } from "@/lib/vistagem/juridico-server";
import { sincronizarPastasVios } from "@/lib/vistagem/pastas-vios";
import { sincronizarKurierSharePoint } from "@/lib/vistagem/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Importa o xlsx do dia que o Power Automate deixa no SharePoint (~6h35) e tria as publicações com o SIOE. Na Vercel Hobby o cron roda uma vez por dia com precisão de hora: 10h e 12h UTC (7h–8h e 9h–10h em Brasília). */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  try {
    // Vínculo e auxiliar das pastas (Processos Lista do VIOS) antes de triar o dia.
    const pastasVios = await sincronizarPastasVios().catch((erro: unknown) => ({ erro: erro instanceof Error ? erro.message : String(erro) }));
    const resultado = await sincronizarKurierSharePoint();
    // Aproveita a rodada para trazer o andamento das tarefas enviadas ao robô do SAMA.
    const envios = await atualizarEnvios().catch((erro: unknown) => ({ erro: erro instanceof Error ? erro.message : String(erro) }));
    // Na 2ª tentativa (9h–10h), sem o arquivo do dia, avisa a controladoria pelo WhatsApp.
    const alertaArquivo =
      new URL(request.url).searchParams.get("tentativa") === "2"
        ? await situacaoArquivoDoDia()
            .then(async (situacao) => (situacao.atrasado ? { ...situacao, ...(await alertarArquivoAtrasado(situacao)) } : situacao))
            .catch((erro: unknown) => ({ erro: erro instanceof Error ? erro.message : String(erro) }))
        : null;
    const falhas = resultado.resultados.filter((item) => item.situacao === "erro");
    if (falhas.length || resultado.triagem?.erro) {
      console.error("[cron/vistagem-kurier] falhas", { arquivos: falhas, triagem: resultado.triagem?.erro });
      return NextResponse.json({ success: false, ...resultado, envios, pastasVios, alertaArquivo }, { status: 502 });
    }
    return NextResponse.json({ success: true, ...resultado, envios, pastasVios, alertaArquivo, finishedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao importar a Kurier.";
    console.error("[cron/vistagem-kurier]", message);
    return NextResponse.json({ error: "Não foi possível importar os arquivos da Kurier." }, { status: 500 });
  }
}
