import { comAcesso, lerJson } from "@/lib/processos/http";
import { criarPessoa, listarPessoas, resumoDasPessoas } from "@/lib/processos/pessoas-server";

export const dynamic = "force-dynamic";

/** ?q=&tipo=&situacao=&pagina= — a lista paginada; com ?resumo=1 vêm também os números do topo. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  return comAcesso(async () => {
    const lista = await listarPessoas({
      busca: params.get("q") ?? undefined,
      tipo: params.get("tipo") ?? undefined,
      situacao: params.get("situacao") ?? undefined,
      pagina: Number(params.get("pagina") ?? 0) || 0,
    });
    return params.get("resumo") === "1" ? { ...lista, resumo: await resumoDasPessoas() } : lista;
  });
}

export async function POST(request: Request) {
  return comAcesso(async () => ({ pessoa: await criarPessoa(await lerJson(request)) }));
}
