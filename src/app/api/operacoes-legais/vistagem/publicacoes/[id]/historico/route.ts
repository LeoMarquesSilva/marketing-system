import { NextResponse } from "next/server";
import { comFotosEContexto } from "@/lib/vistagem/historico-server";
import { exigirPerfilVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { historicoDaPublicacao } from "@/lib/vistagem/juridico-server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * O que aconteceu com a publicação (triagem, transferência, vistagem, conferência, robô…), para o botão "Histórico".
 * A controladoria abre o de qualquer uma; o jurídico, o das publicações da sua área (na Vistagem, as transferidas),
 * normais e de risco: ver não depende de vistar risco.
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { areas } = await exigirPerfilVistagem();
    const { id } = await context.params;
    return NextResponse.json({ historico: await comFotosEContexto(id, await historicoDaPublicacao(id, areas)) });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível carregar o histórico da publicação.");
  }
}
