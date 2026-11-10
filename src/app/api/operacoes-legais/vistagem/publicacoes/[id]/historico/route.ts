import { NextResponse } from "next/server";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { historicoDaPublicacao } from "@/lib/vistagem/juridico-server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** O que aconteceu com a publicação (triagem, transferência, vistagem, conferência, robô…), para o botão "Histórico". */
export async function GET(_request: Request, context: RouteContext) {
  try {
    await exigirAcessoVistagem();
    const { id } = await context.params;
    return NextResponse.json({ historico: await historicoDaPublicacao(id) });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível carregar o histórico da publicação.");
  }
}
