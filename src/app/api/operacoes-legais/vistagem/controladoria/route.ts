import { NextResponse } from "next/server";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";
import { listarPendenciasControladoria } from "@/lib/vistagem/server";

export const dynamic = "force-dynamic";

/** Fila da controladoria: pendências de triagem e publicações de ex-clientes. */
export async function GET() {
  try {
    await exigirAcessoVistagem();
    return NextResponse.json(await listarPendenciasControladoria());
  } catch (error) {
    return respostaDeErro(error, "Não foi possível carregar as pendências da controladoria.");
  }
}
