import { NextResponse } from "next/server";
import { respostaDeErro } from "@/lib/processos/http";
import { exigirRobo, proximoPedido } from "@/lib/processos/robo-server";

export const dynamic = "force-dynamic";

/** O robô de autos pede o próximo da fila. Corpo: { conectores: ["esaj:TJSP"], robo: "nome-da-maquina" }. */
export async function POST(request: Request) {
  try {
    exigirRobo(request);
    return NextResponse.json({ pedido: await proximoPedido(await request.json().catch(() => null)) });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
