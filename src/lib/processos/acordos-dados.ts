import "server-only";

import type { Acordo, Parcela, SituacaoDeclarada } from "./acordos";
import { db, emLotes, falhou } from "./server";

/** Leitura dos acordos e parcelas (sem histórico): usada pela ficha, pela carteira e pelo cálculo do valor atualizado. */

export type Linha = Record<string, unknown>;

export const COLUNAS_ACORDO =
  "id, processo_id, posicao, celebrado_em, homologado_em, valor_total, multa_percentual, situacao, descumprido_em, observacao, origem, documento_id, pagina, criado_por_nome, created_at";
export const COLUNAS_PARCELA = "id, acordo_id, processo_id, numero, vencimento, valor, pago_em, valor_pago, observacao, origem, documento_id, pagina";

export const texto = (valor: unknown) => (typeof valor === "string" && valor ? valor : null);
export const numero = (valor: unknown) => (valor === null || valor === undefined || valor === "" ? null : Number(valor));

function paraParcela(linha: Linha): Parcela {
  return {
    id: linha.id as string,
    numero: Number(linha.numero),
    vencimento: linha.vencimento as string,
    valor: Number(linha.valor),
    pagoEm: texto(linha.pago_em),
    valorPago: numero(linha.valor_pago),
    observacao: texto(linha.observacao),
    origem: linha.origem === "autos" ? "autos" : "manual",
    documentoId: texto(linha.documento_id),
    pagina: numero(linha.pagina),
  };
}

function paraAcordo(linha: Linha, parcelas: Parcela[]): Acordo {
  return {
    id: linha.id as string,
    processoId: linha.processo_id as string,
    posicao: linha.posicao === "paga" ? "paga" : "recebe",
    celebradoEm: texto(linha.celebrado_em),
    homologadoEm: texto(linha.homologado_em),
    valorTotal: Number(linha.valor_total),
    multaPercentual: numero(linha.multa_percentual),
    situacao: (linha.situacao as SituacaoDeclarada) ?? "vigente",
    descumpridoEm: texto(linha.descumprido_em),
    observacao: texto(linha.observacao),
    origem: linha.origem === "autos" ? "autos" : "manual",
    documentoId: texto(linha.documento_id),
    pagina: numero(linha.pagina),
    criadoPorNome: texto(linha.criado_por_nome),
    parcelas: [...parcelas].sort((a, b) => a.numero - b.numero),
  };
}

/** Acordos de vários processos (a carteira), com as parcelas. */
export async function acordosPorProcesso(processos: string[]): Promise<Map<string, Acordo[]>> {
  const ler = async (tabela: string, colunas: string) => {
    const linhas: Linha[] = [];
    for (const lote of emLotes(processos, 200)) {
      for (let inicio = 0; ; inicio += 1000) {
        const { data, error } = await db().from(tabela).select(colunas).in("processo_id", lote).range(inicio, inicio + 999);
        if (error) falhou("carregar os acordos", error);
        linhas.push(...((data ?? []) as unknown as Linha[]));
        if (!data || data.length < 1000) break;
      }
    }
    return linhas;
  };
  const [acordos, parcelas] = await Promise.all([ler("proc_acordos", COLUNAS_ACORDO), ler("proc_acordo_parcelas", COLUNAS_PARCELA)]);
  const parcelasDe = new Map<string, Parcela[]>();
  for (const linha of parcelas) parcelasDe.set(linha.acordo_id as string, [...(parcelasDe.get(linha.acordo_id as string) ?? []), paraParcela(linha)]);
  const mapa = new Map<string, Acordo[]>();
  for (const linha of acordos.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) {
    const id = linha.processo_id as string;
    mapa.set(id, [...(mapa.get(id) ?? []), paraAcordo(linha, parcelasDe.get(linha.id as string) ?? [])]);
  }
  return mapa;
}

export async function carregarAcordos(processoId: string): Promise<Acordo[]> {
  return (await acordosPorProcesso([processoId])).get(processoId) ?? [];
}
