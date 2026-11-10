import { NextResponse } from "next/server";
import { exigirPerfilVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { historicoDaPublicacao } from "@/lib/vistagem/juridico-server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * O que aconteceu com a publicação (triagem, transferência, vistagem, conferência, robô…), para o botão "Histórico".
 * A controladoria abre o de qualquer uma; o jurídico, só o das publicações da sua área (na Vistagem, as transferidas).
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { areas, veRisco } = await exigirPerfilVistagem();
    const { id } = await context.params;
    return NextResponse.json({ historico: await historicoDaPublicacao(id, areas, veRisco) });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível carregar o histórico da publicação.");
  }
}
