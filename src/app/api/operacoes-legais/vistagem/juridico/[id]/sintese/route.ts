import { NextResponse } from "next/server";
import { exigirPerfilVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { LIMITE_TRECHO_SINTESE } from "@/lib/vistagem/dados-processo";
import { pedirAtualizacaoSintese } from "@/lib/vistagem/juridico-server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** "Atualizar Síntese": põe na fila do robô o trecho a acrescentar à síntese da pasta no VIOS. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { authUserId, areas, veRisco } = await exigirPerfilVistagem();
    const { id } = await context.params;
    const corpo = (await request.json().catch(() => null)) as { texto?: unknown; materias?: unknown } | null;
    const texto = typeof corpo?.texto === "string" ? corpo.texto.slice(0, LIMITE_TRECHO_SINTESE + 1) : "";
    return NextResponse.json({ sintesesPedidas: await pedirAtualizacaoSintese(id, texto, corpo?.materias, authUserId, areas, veRisco) });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível pedir a atualização da síntese.");
  }
}
