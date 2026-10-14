import { NextResponse } from "next/server";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { listarPublicacoesDoArquivo } from "@/lib/vistagem/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    await exigirAcessoVistagem();
    const { id } = await context.params;
    return NextResponse.json({ publicacoes: await listarPublicacoesDoArquivo(id) });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível carregar as publicações do arquivo.");
  }
}
