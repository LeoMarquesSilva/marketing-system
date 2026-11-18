import { NextResponse } from "next/server";
import { completarProximaCapa } from "@/lib/processos/capa-server";
import { respostaDeErro } from "@/lib/processos/http";
import { exigirRobo } from "@/lib/processos/robo-server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * O robô, com a fila de autos vazia, pede a capa do próximo processo no DataJud. Uma consulta por chamada
 * (o DataJud leva até um minuto e recusa rajadas); as sugestões ficam na ficha para aprovação.
 */
export async function POST(request: Request) {
  try {
    exigirRobo(request);
    return NextResponse.json(await completarProximaCapa());
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
