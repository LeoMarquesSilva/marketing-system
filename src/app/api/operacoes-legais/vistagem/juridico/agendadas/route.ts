import { NextResponse } from "next/server";
import { exigirPerfilVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { DIAS_AGENDADAS, listarAgendadasJuridico } from "@/lib/vistagem/juridico-server";

export const dynamic = "force-dynamic";

/** O que o jurídico vistou nos últimos dias, opcionalmente de um escritório; o jurídico vê só as suas áreas. */
export async function GET(request: Request) {
  try {
    const { areas, veRisco } = await exigirPerfilVistagem();
    const escritorio = new URL(request.url).searchParams.get("escritorio")?.trim() || null;
    return NextResponse.json({ itens: await listarAgendadasJuridico(escritorio, areas, veRisco), dias: DIAS_AGENDADAS });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível carregar o que foi agendado.");
  }
}
