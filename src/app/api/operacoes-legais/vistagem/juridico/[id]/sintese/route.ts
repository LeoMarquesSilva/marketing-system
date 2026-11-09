import { NextResponse } from "next/server";
import { exigirPerfilVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { LIMITE_TRECHO_SINTESE } from "@/lib/vistagem/dados-processo";
import { pedirAtualizacaoSintese } from "@/lib/vistagem/juridico-server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** "Atualizar cadastro no VIOS": põe na fila do robô o trecho da síntese, a Matéria e/ou o Sistema do Tribunal. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { authUserId, areas, veRisco } = await exigirPerfilVistagem();
    const { id } = await context.params;
    const corpo = (await request.json().catch(() => null)) as { texto?: unknown; materias?: unknown; sistema?: unknown } | null;
    const texto = typeof corpo?.texto === "string" ? corpo.texto.slice(0, LIMITE_TRECHO_SINTESE + 1) : "";
    const pedido = { texto, materias: corpo?.materias, sistema: corpo?.sistema };
    return NextResponse.json({ sintesesPedidas: await pedirAtualizacaoSintese(id, pedido, authUserId, areas, veRisco) });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível pedir a atualização do cadastro no VIOS.");
  }
}
