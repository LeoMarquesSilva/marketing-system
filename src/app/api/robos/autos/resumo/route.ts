import { NextResponse } from "next/server";
import { respostaDeErro } from "@/lib/processos/http";
import { exigirRobo, resumoDaFila } from "@/lib/processos/robo-server";

export const dynamic = "force-dynamic";

/** Resumo da fila do robô de autos para o painel de robôs (Easypanel), com o mesmo token do robô. Só leitura. */
export async function GET(request: Request) {
  try {
    exigirRobo(request);
    return NextResponse.json({ resumo: await resumoDaFila() }, { headers: { "Cache-Control": "no-store" } });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
