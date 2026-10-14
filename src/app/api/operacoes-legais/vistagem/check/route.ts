import { NextResponse } from "next/server";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { listarCheck } from "@/lib/vistagem/juridico-server";

export const dynamic = "force-dynamic";

/** Publicações agendadas pelo robô aguardando o check, em revisão e já checadas. */
export async function GET() {
  try {
    await exigirAcessoVistagem();
    return NextResponse.json(await listarCheck());
  } catch (error) {
    return respostaDeErro(error, "Não foi possível carregar o check dos agendamentos.");
  }
}
