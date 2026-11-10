import { NextResponse } from "next/server";
import { capaNoDataJud, numeroDaPublicacao } from "@/lib/vistagem/capa-abertura-server";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";

export const dynamic = "force-dynamic";
// O DataJud leva de 15 s a mais de 1 min (e às vezes recusa por sobrecarga): fica numa rota à parte.
export const maxDuration = 90;

type RouteContext = { params: Promise<{ id: string }> };

/** O processo no DataJud: sistema, data de ajuizamento e assuntos, para completar a capa da abertura. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    await exigirAcessoVistagem();
    const { id } = await context.params;
    return NextResponse.json({ datajud: await capaNoDataJud(await numeroDaPublicacao(id)) });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível consultar o DataJud.");
  }
}
