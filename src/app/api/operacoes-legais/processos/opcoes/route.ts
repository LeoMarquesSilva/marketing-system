import { comAcesso, lerJson } from "@/lib/processos/http";
import { incluirOpcao, opcoesDaLista, opcoesParaEdicao, resumoDasListas } from "@/lib/processos/opcoes-server";
import { definicaoDaLista } from "@/lib/processos/opcoes";

export const dynamic = "force-dynamic";

/**
 * Sem parâmetros: resumo das listas (tela de Cadastros).
 * `?lista=x`: todas as opções da lista, ativas e desativadas (tela de Cadastros).
 * `?listas=a,b&uf=SP`: só as ativas, para a edição do processo; cidade e comarca só da UF (sem UF, vazias).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const lista = url.searchParams.get("lista");
  const listas = url.searchParams.get("listas");
  const uf = url.searchParams.get("uf");
  return comAcesso(async () => {
    if (lista) return { opcoes: await opcoesDaLista(lista, uf) };
    if (listas) {
      const pedidas = listas.split(",").map((item) => item.trim()).filter(Boolean);
      const semUf = pedidas.filter((item) => !(definicaoDaLista(item)?.porUf && !uf));
      const opcoes = await opcoesParaEdicao(semUf, uf);
      for (const item of pedidas) opcoes[item] ??= [];
      return { opcoes };
    }
    return { listas: await resumoDasListas() };
  });
}

/** Corpo: { lista, valor, uf? }. */
export async function POST(request: Request) {
  return comAcesso(async (ator) => {
    const corpo = await lerJson(request);
    return { opcao: await incluirOpcao(String(corpo.lista ?? ""), corpo, ator) };
  });
}
