import { NextResponse } from "next/server";
import { exigirPerfilVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { listarAgendadasJuridico } from "@/lib/vistagem/juridico-server";

export const dynamic = "force-dynamic";

/** O que o jurídico vistou nos últimos dias (com as fotos de quem aparece), opcionalmente de um escritório; o jurídico vê só as suas áreas. */
export async function GET(request: Request) {
  try {
    const { authUserId, areas, veRisco, admin } = await exigirPerfilVistagem();
    const escritorio = new URL(request.url).searchParams.get("escritorio")?.trim() || null;
    // Com quem está vendo: nas que aguardam a Conferência, diz se a pessoa pode reabrir a vistagem para alterar.
    return NextResponse.json(await listarAgendadasJuridico(escritorio, areas, veRisco, authUserId, admin));
  } catch (error) {
    return respostaDeErro(error, "Não foi possível carregar o que foi agendado.");
  }
}
