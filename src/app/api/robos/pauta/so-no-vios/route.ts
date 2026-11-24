import { NextResponse } from "next/server";
import { soNoViosParaORobo } from "@/lib/audiencias/conferencia-server";
import { exigirRobo, respostaDeErro } from "@/lib/audiencias/http";

export const dynamic = "force-dynamic";

/**
 * Para o robô da pauta (Authorization: Bearer ROBO_AUTOS_TOKEN): as audiências "só no VIOS" da última conferência
 * automática, que ele procura no Jus.br. `?tribunal=TRT15` filtra pelo número do processo.
 */
export async function GET(request: Request) {
  try {
    exigirRobo(request);
    return NextResponse.json(await soNoViosParaORobo(new URL(request.url).searchParams.get("tribunal")));
  } catch (error) {
    return respostaDeErro(error);
  }
}
