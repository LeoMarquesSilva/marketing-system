import { NextResponse, type NextRequest } from "next/server";
import { exigirPerfilVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { periodoValido } from "@/lib/vistagem/visao-geral";
import { obterVisaoGeral } from "@/lib/vistagem/visao-geral-server";

export const dynamic = "force-dynamic";

/**
 * Visão geral da Vistagem: o que chegou no período (?dias=1|7|30) e onde estão as publicações agora. A controladoria
 * vê tudo; o jurídico, só as suas áreas (normais e de risco: a marca de risco só vale para vistar), filtradas na consulta.
 */
export async function GET(request: NextRequest) {
  try {
    const { areas } = await exigirPerfilVistagem();
    return NextResponse.json(await obterVisaoGeral(periodoValido(request.nextUrl.searchParams.get("dias")), { areas }));
  } catch (error) {
    return respostaDeErro(error, "Não foi possível carregar a visão geral.");
  }
}
