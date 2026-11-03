import { NextResponse } from "next/server";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { triarPublicacoes } from "@/lib/vistagem/server";
import { gerarSugestoesDeTriagem } from "@/lib/vistagem/sugestao-triagem-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Roda a triagem agora: captadas ainda não triadas e as que estavam sem pasta; depois sugere os dados das sem pasta. */
export async function POST() {
  try {
    await exigirAcessoVistagem();
    const triagem = await triarPublicacoes({ incluirSemPasta: true });
    const sugestoes = await gerarSugestoesDeTriagem(120_000).catch((erro: unknown) => ({ erro: erro instanceof Error ? erro.message : String(erro) }));
    return NextResponse.json({ ...triagem, sugestoes });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível rodar a triagem.");
  }
}
