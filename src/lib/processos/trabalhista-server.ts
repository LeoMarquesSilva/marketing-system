import "server-only";

import { ProcessosError } from "./errors";
import { atualizarProcesso, detalharProcesso, registrarNoHistorico } from "./processos-server";
import { db, emLotes, falhou, type Ator } from "./server";
import {
  TABELA_DO_ITEM_TRABALHISTA,
  calcularRiscoDoProcesso,
  colunasDoItemTrabalhista,
  descreverItemTrabalhista,
  ehTrabalhista,
  parametrosDoAdicional,
  type Afastamento,
  type ItensTrabalhistas,
  type ParametrosDoAdicional,
  type PedidoTrabalhista,
  type ResultadoDoAdicional,
  type TipoItemTrabalhista,
} from "./trabalhista";
import type { ProcessoDetalhe } from "./types";

type Linha = Record<string, unknown>;

const ROTULO_HISTORICO = "trabalhista";
const COMUNS = "id, processo_id, origem, documento_id, pagina, criado_por_nome, created_at";
const SELECAO: Record<TipoItemTrabalhista, string> = {
  afastamento: `${COMUNS}, inicio, fim, especie, observacao`,
  pedido: `${COMUNS}, pedido, valor_pedido, resultado_sentenca, resultado_acordao, resultado_rr, detalhe, prescricao, prescricao_marco`,
};

const texto = (valor: unknown) => (typeof valor === "string" && valor ? valor : null);
const numero = (valor: unknown) => (valor === null || valor === undefined || valor === "" ? null : Number(valor));

function comuns(linha: Linha) {
  return {
    id: linha.id as string,
    origem: linha.origem as "manual" | "autos",
    documentoId: texto(linha.documento_id),
    pagina: numero(linha.pagina),
    criadoPorNome: texto(linha.criado_por_nome),
  };
}

const paraAfastamento = (linha: Linha): Afastamento => ({
  ...comuns(linha),
  inicio: linha.inicio as string,
  fim: texto(linha.fim),
  especie: linha.especie as Afastamento["especie"],
  observacao: texto(linha.observacao),
});

const paraPedido = (linha: Linha): PedidoTrabalhista => ({
  ...comuns(linha),
  pedido: linha.pedido as string,
  valorPedido: numero(linha.valor_pedido),
  resultadoSentenca: (texto(linha.resultado_sentenca) as PedidoTrabalhista["resultadoSentenca"]) ?? null,
  resultadoAcordao: (texto(linha.resultado_acordao) as PedidoTrabalhista["resultadoAcordao"]) ?? null,
  resultadoRr: (texto(linha.resultado_rr) as PedidoTrabalhista["resultadoRr"]) ?? null,
  detalhe: texto(linha.detalhe),
  prescricao: (texto(linha.prescricao) as PedidoTrabalhista["prescricao"]) ?? null,
  prescricaoMarco: texto(linha.prescricao_marco),
});

async function lerTabela(tipo: TipoItemTrabalhista, processos: string[]): Promise<Linha[]> {
  const linhas: Linha[] = [];
  for (const lote of emLotes(processos, 200)) {
    const { data, error } = await db().from(TABELA_DO_ITEM_TRABALHISTA[tipo]).select(SELECAO[tipo]).in("processo_id", lote).order("created_at").limit(5000);
    if (error) falhou("carregar o saneamento trabalhista", error);
    linhas.push(...((data ?? []) as unknown as Linha[]));
  }
  return linhas;
}

/** Afastamentos e pedidos de vários processos (o painel de acordos usa os afastamentos no cálculo). */
export async function itensTrabalhistasPorProcesso(processos: string[]): Promise<Map<string, ItensTrabalhistas>> {
  const mapa = new Map<string, ItensTrabalhistas>();
  if (!processos.length) return mapa;
  const [afastamentos, pedidos] = await Promise.all([lerTabela("afastamento", processos), lerTabela("pedido", processos)]);
  const de = (id: string) => {
    let itens = mapa.get(id);
    if (!itens) {
      itens = { afastamentos: [], pedidos: [] };
      mapa.set(id, itens);
    }
    return itens;
  };
  for (const linha of afastamentos) de(linha.processo_id as string).afastamentos.push(paraAfastamento(linha));
  for (const linha of pedidos) de(linha.processo_id as string).pedidos.push(paraPedido(linha));
  for (const itens of mapa.values()) itens.afastamentos.sort((a, b) => a.inicio.localeCompare(b.inicio));
  return mapa;
}

export async function itensTrabalhistasDoProcesso(processoId: string): Promise<ItensTrabalhistas> {
  return (await itensTrabalhistasPorProcesso([processoId])).get(processoId) ?? { afastamentos: [], pedidos: [] };
}

export interface TrabalhistaDoProcesso extends ItensTrabalhistas {
  /** O cálculo do adicional pelos campos da ficha, ou nulo com o que falta em `parametros.faltando`. */
  calculo: ResultadoDoAdicional | null;
  parametros: ParametrosDoAdicional;
  erroCalculo: string | null;
}

export async function carregarTrabalhista(processoId: string, processo?: ProcessoDetalhe): Promise<TrabalhistaDoProcesso> {
  const [itens, detalhe] = await Promise.all([itensTrabalhistasDoProcesso(processoId), processo ? Promise.resolve(processo) : detalharProcesso(processoId)]);
  try {
    const { resultado, parametros } = calcularRiscoDoProcesso(detalhe.valores, itens.afastamentos);
    return { ...itens, calculo: resultado, parametros, erroCalculo: null };
  } catch (erro) {
    if (!(erro instanceof ProcessosError)) throw erro;
    return { ...itens, calculo: null, parametros: parametrosDoAdicional(detalhe.valores), erroCalculo: erro.message };
  }
}

async function exigirProcessoTrabalhista(processoId: string): Promise<void> {
  const { data, error } = await db().from("proc_processos").select("id, area").eq("id", processoId).maybeSingle();
  if (error) falhou("carregar o processo", error);
  if (!data) throw new ProcessosError("Processo não encontrado.", 404);
  if (!ehTrabalhista(data.area)) throw new ProcessosError("Afastamentos e pedidos são do saneamento trabalhista: este processo não é da área Trabalhista.", 400);
}

export async function incluirItemTrabalhista(
  processoId: string,
  tipo: TipoItemTrabalhista,
  dados: Record<string, unknown>,
  ator: Ator,
  dosAutos?: { documentoId: string | null; pagina: number | null }
): Promise<TrabalhistaDoProcesso> {
  const colunas = colunasDoItemTrabalhista(tipo, dados);
  await exigirProcessoTrabalhista(processoId);
  const { error } = await db()
    .from(TABELA_DO_ITEM_TRABALHISTA[tipo])
    .insert({
      processo_id: processoId,
      ...colunas,
      origem: dosAutos ? "autos" : "manual",
      documento_id: dosAutos?.documentoId ?? null,
      pagina: dosAutos?.pagina ?? null,
      criado_por: ator.authUserId,
      criado_por_nome: ator.nome,
    });
  if (error) falhou("incluir o item", error);
  await registrarNoHistorico(processoId, ROTULO_HISTORICO, null, `Incluído: ${descreverItemTrabalhista(tipo, colunas)}`, ator, dosAutos ? "ia" : "manual");
  return carregarTrabalhista(processoId);
}

async function itemExistente(tipo: TipoItemTrabalhista, itemId: string): Promise<Linha> {
  if (!/^[0-9a-f-]{36}$/i.test(itemId)) throw new ProcessosError("Item não encontrado.", 404);
  const { data, error } = await db().from(TABELA_DO_ITEM_TRABALHISTA[tipo]).select(SELECAO[tipo]).eq("id", itemId).maybeSingle();
  if (error) falhou("carregar o item", error);
  if (!data) throw new ProcessosError("Item não encontrado.", 404);
  return data as unknown as Linha;
}

export async function alterarItemTrabalhista(tipo: TipoItemTrabalhista, itemId: string, dados: Record<string, unknown>, ator: Ator): Promise<TrabalhistaDoProcesso> {
  const atual = await itemExistente(tipo, itemId);
  const colunas = colunasDoItemTrabalhista(tipo, dados);
  const { error } = await db().from(TABELA_DO_ITEM_TRABALHISTA[tipo]).update(colunas).eq("id", itemId);
  if (error) falhou("salvar o item", error);
  await registrarNoHistorico(atual.processo_id as string, ROTULO_HISTORICO, descreverItemTrabalhista(tipo, atual), `Alterado: ${descreverItemTrabalhista(tipo, colunas)}`, ator);
  return carregarTrabalhista(atual.processo_id as string);
}

export async function excluirItemTrabalhista(tipo: TipoItemTrabalhista, itemId: string, ator: Ator): Promise<TrabalhistaDoProcesso> {
  const atual = await itemExistente(tipo, itemId);
  const { error } = await db().from(TABELA_DO_ITEM_TRABALHISTA[tipo]).delete().eq("id", itemId);
  if (error) falhou("excluir o item", error);
  await registrarNoHistorico(atual.processo_id as string, ROTULO_HISTORICO, descreverItemTrabalhista(tipo, atual), "Excluído", ator);
  return carregarTrabalhista(atual.processo_id as string);
}

/**
 * Grava na ficha o risco calculado (valor, % de reflexos, reflexos e total), pelo mesmo caminho da edição da tela:
 * entra no histórico. A pessoa pode ajustar os números depois, editando o grupo "Risco trabalhista".
 */
export async function aplicarRiscoCalculado(processoId: string, ator: Ator): Promise<{ processo: ProcessoDetalhe; trabalhista: TrabalhistaDoProcesso }> {
  await exigirProcessoTrabalhista(processoId);
  const atual = await carregarTrabalhista(processoId);
  if (!atual.calculo) {
    throw new ProcessosError(atual.erroCalculo ?? `Não dá para calcular ainda: falta ${atual.parametros.faltando.join(", ")}.`, 400);
  }
  const processo = await atualizarProcesso(
    processoId,
    {
      risco_valor: atual.calculo.principal,
      risco_reflexos_percentual: atual.calculo.reflexosPercentual,
      risco_reflexos: atual.calculo.reflexos,
      risco_total: atual.calculo.total,
    },
    ator
  );
  return { processo, trabalhista: await carregarTrabalhista(processoId, processo) };
}
