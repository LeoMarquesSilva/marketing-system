import { NextResponse } from "next/server";
import { situacaoArquivoDoDia } from "@/lib/vistagem/alerta-arquivo-server";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";

export const dynamic = "force-dynamic";

/** O arquivo da Kurier de hoje chegou? (faixa de aviso nas abas Captura e Controladoria) */
export async function GET() {
  try {
    await exigirAcessoVistagem();
    return NextResponse.json(await situacaoArquivoDoDia());
  } catch (error) {
    return respostaDeErro(error, "Não foi possível conferir o arquivo do dia.");
  }
}
