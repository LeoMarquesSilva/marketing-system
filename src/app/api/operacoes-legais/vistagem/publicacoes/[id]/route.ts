import { NextResponse } from "next/server";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { obterPublicacao } from "@/lib/vistagem/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Publicação com o teor completo (a listagem traz o teor resumido). */
export async function GET(_request: Request, context: RouteContext) {
  try {
    await exigirAcessoVistagem();
    const { id } = await context.params;
    return NextResponse.json({ publicacao: await obterPublicacao(id) });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível carregar a publicação.");
  }
}
