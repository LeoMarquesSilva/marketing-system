import { NextResponse } from "next/server";
import { exigirPerfilVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { reabrirVistagem } from "@/lib/vistagem/juridico-server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Quem vistou (ou um admin) reabre a vistagem para alterar, antes da Conferência: volta para "A vistar" com as tarefas como estão.
 * Recusa (409) se a controladoria já agiu ou está com a publicação aberta: a decisão dela vale.
 */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { authUserId, areas, veRisco, admin } = await exigirPerfilVistagem();
    const { id } = await context.params;
    await reabrirVistagem(id, authUserId, areas, veRisco, admin);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível reabrir a vistagem.");
  }
}
