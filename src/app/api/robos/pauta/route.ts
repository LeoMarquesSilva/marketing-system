import { NextResponse } from "next/server";
import { exigirRobo, respostaDeErro } from "@/lib/audiencias/http";
import { registrarLeituraPje } from "@/lib/audiencias/leitura-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * O robô da pauta (robos/autos, comando `pauta`) manda aqui o que leu na Minha Pauta do PJe:
 * { tribunal: "TRT15", origem: "robô do Mac", registros: [...] } com Authorization: Bearer ROBO_AUTOS_TOKEN.
 */
export async function POST(request: Request) {
  try {
    exigirRobo(request);
    return NextResponse.json(await registrarLeituraPje(await request.json()));
  } catch (error) {
    return respostaDeErro(error);
  }
}
