import { NextResponse } from "next/server";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { listarFilaJuridico } from "@/lib/vistagem/juridico-server";

export const dynamic = "force-dynamic";

/** Fila "Jurídico vistar", opcionalmente de um escritório. */
export async function GET(request: Request) {
  try {
    await exigirAcessoVistagem();
    const escritorio = new URL(request.url).searchParams.get("escritorio")?.trim() || null;
    return NextResponse.json(await listarFilaJuridico(escritorio));
  } catch (error) {
    return respostaDeErro(error, "Não foi possível carregar a fila do jurídico.");
  }
}
