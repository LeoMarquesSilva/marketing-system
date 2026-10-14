import { NextResponse } from "next/server";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { listarInconsistencias } from "@/lib/vistagem/juridico-server";

export const dynamic = "force-dynamic";

/** Inconsistências abertas, contestadas pelo jurídico ou excluídas. */
export async function GET(request: Request) {
  try {
    await exigirAcessoVistagem();
    const valor = new URL(request.url).searchParams.get("situacao");
    const situacao = valor === "contestadas" || valor === "excluidas" ? valor : "abertas";
    return NextResponse.json({ inconsistencias: await listarInconsistencias(situacao) });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível carregar as inconsistências.");
  }
}
