import "server-only";

import { TabelaTjsp, type IndiceMensal } from "./calculo-tjsp";
import { URL_PLANILHA_TJSP, lerIndicesDaPlanilha } from "./indices-tjsp";
import { db, falhou } from "./server";

/** Índices do TJSP gravados no banco, prontos para o cálculo. */
export async function carregarTabelaTjsp(): Promise<TabelaTjsp> {
  const indices: IndiceMensal[] = [];
  for (let inicio = 0; ; inicio += 1000) {
    const { data, error } = await db().from("proc_indices_tjsp").select("mes, tabela_pratica, taxa_legal").order("mes").range(inicio, inicio + 999);
    if (error) falhou("carregar os índices do TJSP", error);
    for (const linha of data ?? []) {
      indices.push({ mes: String(linha.mes), tabelaPratica: Number(linha.tabela_pratica), taxaLegal: linha.taxa_legal === null ? null : Number(linha.taxa_legal) });
    }
    if (!data || data.length < 1000) break;
  }
  return new TabelaTjsp(indices);
}

export interface SituacaoIndices {
  meses: number;
  ultimoMes: string | null;
  importadoEm: string | null;
}

export async function situacaoDosIndices(): Promise<SituacaoIndices> {
  const [{ count, error }, ultimo] = await Promise.all([
    db().from("proc_indices_tjsp").select("mes", { count: "exact", head: true }),
    db().from("proc_indices_tjsp").select("mes, importado_em").order("mes", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (error) falhou("contar os índices do TJSP", error);
  if (ultimo.error) falhou("ler o último índice do TJSP", ultimo.error);
  return { meses: count ?? 0, ultimoMes: (ultimo.data?.mes as string | undefined) ?? null, importadoEm: (ultimo.data?.importado_em as string | undefined) ?? null };
}

/** Rotina diária: reimporta quando a última importação tem mais de uma semana (o TJSP publica uma vez por mês). */
export async function atualizarIndicesSeVelhos(): Promise<ResultadoIndices | null> {
  const situacao = await situacaoDosIndices();
  const semana = 7 * 24 * 60 * 60 * 1000;
  if (situacao.importadoEm && Date.now() - new Date(situacao.importadoEm).getTime() < semana) return null;
  return importarIndicesTjsp();
}

export interface ResultadoIndices {
  meses: number;
  primeiro: string | null;
  ultimo: string | null;
}

/**
 * Baixa a planilha oficial do TJSP e grava os índices mensais (o que já existe é atualizado: o tribunal corrige
 * meses recentes de vez em quando). Leva alguns segundos: a planilha tem cerca de 5 MB.
 */
export async function importarIndicesTjsp(): Promise<ResultadoIndices> {
  const resposta = await fetch(URL_PLANILHA_TJSP, { signal: AbortSignal.timeout(120_000) });
  if (!resposta.ok) throw new Error(`O site do TJSP respondeu ${resposta.status} ao baixar a planilha de índices.`);
  const arquivo = new Uint8Array(await resposta.arrayBuffer());
  if (arquivo[0] !== 0x50 || arquivo[1] !== 0x4b) throw new Error("O TJSP não devolveu a planilha de índices (o arquivo não é um Excel).");
  const indices = await lerIndicesDaPlanilha(arquivo);
  if (indices.length < 100) throw new Error(`A planilha do TJSP trouxe só ${indices.length} meses de índices. Nada foi gravado.`);

  const agora = new Date().toISOString();
  const linhas = indices.map((indice) => ({ mes: indice.mes, tabela_pratica: indice.tabelaPratica, taxa_legal: indice.taxaLegal, importado_em: agora }));
  for (let inicio = 0; inicio < linhas.length; inicio += 500) {
    const { error } = await db().from("proc_indices_tjsp").upsert(linhas.slice(inicio, inicio + 500), { onConflict: "mes" });
    if (error) falhou("gravar os índices do TJSP", error);
  }
  return { meses: indices.length, primeiro: indices[0]?.mes ?? null, ultimo: indices.at(-1)?.mes ?? null };
}
