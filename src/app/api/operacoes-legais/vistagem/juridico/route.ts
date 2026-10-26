import { NextResponse } from "next/server";
import { exigirPerfilVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { listarFilaJuridico } from "@/lib/vistagem/juridico-server";

export const dynamic = "force-dynamic";

/** Fila "Jurídico vistar", opcionalmente de um escritório; o jurídico vê só as suas áreas. */
export async function GET(request: Request) {
  try {
    const { areas } = await exigirPerfilVistagem();
    const escritorio = new URL(request.url).searchParams.get("escritorio")?.trim() || null;
    return NextResponse.json({ ...(await listarFilaJuridico(escritorio, areas)), areas });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível carregar a fila do jurídico.");
  }
}
