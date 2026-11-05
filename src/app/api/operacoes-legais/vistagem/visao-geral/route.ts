import { NextResponse, type NextRequest } from "next/server";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { periodoValido } from "@/lib/vistagem/visao-geral";
import { obterVisaoGeral } from "@/lib/vistagem/visao-geral-server";

export const dynamic = "force-dynamic";

/** Visão geral da Vistagem: o que chegou no período (?dias=1|7|30) e onde estão as publicações agora. */
export async function GET(request: NextRequest) {
  try {
    await exigirAcessoVistagem();
    return NextResponse.json(await obterVisaoGeral(periodoValido(request.nextUrl.searchParams.get("dias"))));
  } catch (error) {
    return respostaDeErro(error, "Não foi possível carregar a visão geral.");
  }
}
