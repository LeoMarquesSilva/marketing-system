import { NextResponse } from "next/server";
import { exigirPerfilVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { listarAgendadasJuridico } from "@/lib/vistagem/juridico-server";

export const dynamic = "force-dynamic";

/**
 * O que foi vistado nos últimos dias (com as fotos de quem aparece), opcionalmente de um escritório. O jurídico vê tudo
 * das suas áreas, quem quer que tenha vistado e inclusive as de risco (a marca de risco só vale para a fila).
 */
export async function GET(request: Request) {
  try {
    const { authUserId, areas, admin } = await exigirPerfilVistagem();
    const escritorio = new URL(request.url).searchParams.get("escritorio")?.trim() || null;
    // Com quem está vendo: nas que aguardam a Conferência, diz se a pessoa pode reabrir a vistagem para alterar.
    return NextResponse.json(await listarAgendadasJuridico(escritorio, areas, authUserId, admin));
  } catch (error) {
    return respostaDeErro(error, "Não foi possível carregar o que foi agendado.");
  }
}
