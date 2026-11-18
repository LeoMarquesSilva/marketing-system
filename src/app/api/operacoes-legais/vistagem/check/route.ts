import { NextResponse } from "next/server";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { listarCheck } from "@/lib/vistagem/juridico-server";

export const dynamic = "force-dynamic";

/**
 * Publicações agendadas pelo robô aguardando o check, em revisão e as checadas de um dia de importação
 * (`?importacao=AAAA-MM-DD`; sem ele, hoje).
 */
export async function GET(request: Request) {
  try {
    await exigirAcessoVistagem();
    return NextResponse.json(await listarCheck(new URL(request.url).searchParams.get("importacao")));
  } catch (error) {
    return respostaDeErro(error, "Não foi possível carregar o check dos agendamentos.");
  }
}
