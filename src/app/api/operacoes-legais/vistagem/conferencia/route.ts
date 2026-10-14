import { NextResponse } from "next/server";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { listarConferencia } from "@/lib/vistagem/juridico-server";

export const dynamic = "force-dynamic";

/** Vistagens a conferir e as já enviadas ao robô. */
export async function GET() {
  try {
    await exigirAcessoVistagem();
    return NextResponse.json(await listarConferencia());
  } catch (error) {
    return respostaDeErro(error, "Não foi possível carregar a conferência.");
  }
}
