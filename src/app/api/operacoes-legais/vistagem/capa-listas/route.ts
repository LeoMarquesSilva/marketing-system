import { NextResponse } from "next/server";
import { listasDaCapa } from "@/lib/vistagem/capa-abertura-server";
import { exigirAcessoVistagem, respostaDeErro } from "@/lib/vistagem/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Por quanto tempo o navegador usa as listas sem pedir de novo: o SIOE e o catálogo do VIOS mudam de madrugada. */
const VALIDADE_S = 30 * 60;

/**
 * As listas do VIOS para a capa da abertura (usuários, matérias, sistemas, clientes, ações e etiquetas). São as mesmas
 * para toda publicação: a tela pede uma vez e o navegador guarda por 30 min. Antes vinham em toda capa, e montar as de
 * clientes lê as ~35 mil pastas do SIOE a cada instância nova da Vercel (~700 ms de CPU).
 */
export async function GET() {
  try {
    await exigirAcessoVistagem();
    return NextResponse.json({ listas: await listasDaCapa() }, { headers: { "Cache-Control": `private, max-age=${VALIDADE_S}` } });
  } catch (error) {
    return respostaDeErro(error, "Não foi possível carregar as listas do VIOS para a capa.");
  }
}
