import { NextResponse } from "next/server";
import { capaNoDataJud, numeroDaPublicacao, validadeDoDataJud } from "@/lib/vistagem/capa-abertura-server";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";

export const dynamic = "force-dynamic";
// O DataJud leva de 15 s a mais de 1 min (e às vezes recusa por sobrecarga): fica numa rota à parte.
export const maxDuration = 90;

type RouteContext = { params: Promise<{ id: string }> };

/**
 * O processo no DataJud: sistema, data de ajuizamento e assuntos, para completar a capa da abertura. A resposta fica
 * guardada no navegador pela validade dela (12 h achado, 2 h ainda não indexado; falha não fica). "Buscar de novo"
 * manda o cabeçalho `X-Fresco: 1` (renova a mesma entrada do navegador) e consulta na hora; `?fresco=1` também vale.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    await exigirAcessoVistagem();
    const { id } = await context.params;
    const fresco = new URL(request.url).searchParams.get("fresco") === "1" || request.headers.get("x-fresco") === "1";
    const datajud = await capaNoDataJud(await numeroDaPublicacao(id), { fresco });
    const validade = validadeDoDataJud(datajud);
    return NextResponse.json({ datajud }, { headers: { "Cache-Control": validade ? `private, max-age=${validade}` : "no-store" } });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível consultar o DataJud.");
  }
}
