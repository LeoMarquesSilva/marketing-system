import { NextResponse } from "next/server";
import { capaSemListas, editarCampoDaCapa } from "@/lib/vistagem/capa-abertura-server";
import { VistagemError } from "@/lib/vistagem/errors";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Capa para a abertura de pasta (prévia): DJEN, e-SAJ, triagem, pastas do grupo e as edições da controladoria. As
 * listas do VIOS vêm de /api/operacoes-legais/vistagem/capa-listas. `?fresco=1` ("Buscar de novo") consulta as fontes
 * na hora.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    await exigirAcessoVistagem();
    const { id } = await context.params;
    const fresco = new URL(request.url).searchParams.get("fresco") === "1";
    return NextResponse.json(await capaSemListas(id, { fresco }));
  } catch (error) {
    return respostaDeErro(error, "Não foi possível montar a capa do processo.");
  }
}

/** Edita um campo da capa (lápis) ou desfaz a edição: { chave, valor } ou { chave, desfazer: true }. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const authUserId = await exigirAcessoVistagem();
    const { id } = await context.params;
    const corpo = (await request.json().catch(() => null)) as { chave?: unknown; valor?: unknown; desfazer?: unknown } | null;
    if (!corpo) throw new VistagemError("Corpo inválido.", 400);
    return NextResponse.json({ ajustes: await editarCampoDaCapa(id, corpo, authUserId) });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível gravar a edição da capa.");
  }
}
