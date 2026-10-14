import { NextResponse } from "next/server";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { atualizarEnvios } from "@/lib/vistagem/juridico-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Atualiza, pela fila do SAMA, o andamento das tarefas enviadas ao robô. */
export async function POST() {
  try {
    await exigirAcessoVistagem();
    return NextResponse.json(await atualizarEnvios());
  } catch (error) {
    return respostaDeErro(error, "Não foi possível atualizar os envios.");
  }
}
