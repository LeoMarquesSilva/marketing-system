import { ProcessosError } from "@/lib/processos/errors";
import { comAcesso, lerJson } from "@/lib/processos/http";
import { criarPessoa, listarPessoas, resumoDasPessoas } from "@/lib/processos/pessoas-server";

export const dynamic = "force-dynamic";

/**
 * ?q=&tipo=&situacao=&pagina= — a lista paginada; com ?resumo=1 vêm também os números do topo. A liberação só da
 * Carteira Trabalhista usa apenas a busca por nome, ao cadastrar uma parte na ficha.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  return comAcesso(async (ator) => {
    if (ator.soTrabalhista && (!params.get("q")?.trim() || params.get("resumo") === "1")) {
      throw new ProcessosError("Sem permissão para Pessoas: a sua liberação é só da Carteira Trabalhista.", 403);
    }
    const lista = await listarPessoas({
      busca: params.get("q") ?? undefined,
      tipo: params.get("tipo") ?? undefined,
      situacao: params.get("situacao") ?? undefined,
      pagina: Number(params.get("pagina") ?? 0) || 0,
    });
    return params.get("resumo") === "1" ? { ...lista, resumo: await resumoDasPessoas() } : lista;
  }, "carteira");
}

export async function POST(request: Request) {
  return comAcesso(async () => ({ pessoa: await criarPessoa(await lerJson(request)) }));
}
