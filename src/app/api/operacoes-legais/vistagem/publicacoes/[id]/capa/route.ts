import { NextResponse } from "next/server";
import { capaParaAbertura } from "@/lib/vistagem/capa-abertura-server";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

/** Capa para a abertura de pasta (prévia, só leitura): DJEN, e-SAJ, triagem e pastas do grupo. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    await exigirAcessoVistagem();
    const { id } = await context.params;
    return NextResponse.json(await capaParaAbertura(id));
  } catch (error) {
    return respostaDeErro(error, "Não foi possível montar a capa do processo.");
  }
}
