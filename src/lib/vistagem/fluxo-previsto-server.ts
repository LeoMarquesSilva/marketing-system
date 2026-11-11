import "server-only";

import { areaDoCatalogo, chaveDoCaminho } from "./agendamento";
import { cienciaQueFica, ehCienciaDosAgendamentos } from "./ciencia-agendamentos";
import { criarCalendario } from "./dias-uteis";
import { carregarFeriados } from "./feriados";
import { fluxoPrevisto, prazoApertado } from "./fluxo-previsto";
import { arvoreDaArea, montarFluxo, type TipoNaArvore } from "./fluxo-vios";
import { carregarArvoreVios, carregarCatalogoProcessos, catalogoDaArea, type CatalogoArea } from "./sama";
import type { AgendamentoResumo, TarefaPrevista } from "./types";

/** O que decide a lista de tarefas (e a árvore) de uma publicação: a área da pasta ou, sem ela, a do escritório. */
export type AreaDaPublicacao = { area_processo: string | null; escritorio_responsavel: string | null };

export function catalogoDaPublicacao(areas: CatalogoArea[], publicacao: AreaDaPublicacao): CatalogoArea | null {
  return catalogoDaArea(areas, areaDoCatalogo(publicacao.area_processo, publicacao.escritorio_responsavel, areas.map((item) => item.area)));
}

/** A árvore do VIOS como vale para a pasta da publicação: só os tipos da lista de tarefas da área dela. */
export function arvoreDaPublicacao(arvore: Map<number, TipoNaArvore>, areas: CatalogoArea[], publicacao: AreaDaPublicacao): Map<number, TipoNaArvore> {
  return arvoreDaArea(arvore, catalogoDaPublicacao(areas, publicacao)?.etapas.map((etapa) => etapa.id) ?? null);
}

/**
 * Uma Ciência dos Agendamentos só por vistagem (`cienciaQueFica`): diz, para cada tarefa, se a Ciência num caminho
 * do fluxo dela é a que fica; as outras o robô cancela no VIOS.
 */
function marcarCienciaRepetida<T extends { id: string; ordem: number; tarefa: string; tarefaId: string | null }>(
  agendamentos: T[],
  arvore: Map<number, TipoNaArvore>
): (T & { cienciaFica: (caminho: string[]) => boolean })[] {
  const ordenados = [...agendamentos].sort((a, b) => a.ordem - b.ordem);
  const fica = cienciaQueFica(
    ordenados.map((agendamento) => ({
      chave: agendamento.id,
      nome: agendamento.tarefa,
      fluxo: agendamento.tarefaId ? montarFluxo(agendamento.tarefaId, arvore) : null,
    }))
  );
  return agendamentos.map((agendamento) => ({
    ...agendamento,
    cienciaFica: (caminho: string[]) =>
      !fica || (fica.chave === agendamento.id && fica.caminho !== null && chaveDoCaminho(fica.caminho) === chaveDoCaminho(caminho)),
  }));
}

/** O que o fluxo precisa para prever as tarefas: a árvore do VIOS, os feriados e a lista de tarefas de cada área. */
export interface BaseDoFluxo {
  arvore: Map<number, TipoNaArvore>;
  feriados: string[];
  catalogos: CatalogoArea[];
}

/** Carrega a base do fluxo; se algo falhar, as telas mostram só as tarefas pedidas (null), sem derrubar a resposta. */
export async function carregarBaseDoFluxo(onde: string): Promise<BaseDoFluxo | null> {
  try {
    const [arvore, feriados, catalogos] = await Promise.all([carregarArvoreVios(), carregarFeriados(), carregarCatalogoProcessos()]);
    return { arvore, feriados, catalogos };
  } catch (erro) {
    console.error(`[vistagem] fluxo previsto ${onde}`, erro instanceof Error ? erro.message : erro);
    return null;
  }
}

type TarefaParaPrever = Pick<AgendamentoResumo, "id" | "ordem" | "tarefa" | "tarefaId" | "etiqueta" | "data" | "dataFatal" | "responsavel" | "revisor" | "fluxoDatas">;

/**
 * O que o fluxo do VIOS cria com cada tarefa da vistagem, com a data e quem fica em cada uma (`fluxoPrevisto`), e o
 * Enviar de hoje no prazo apertado. A Ciência dos Agendamentos que se repete entre as tarefas sai marcada como
 * repetida (o robô cancela; quem agenda à mão não cria).
 */
export function comFluxoPrevisto<T extends TarefaParaPrever>(
  agendamentos: T[],
  publicacao: AreaDaPublicacao,
  base: BaseDoFluxo,
  hoje: string,
  ehDiaUtil: (iso: string) => boolean = criarCalendario(base.feriados)
): (T & { enviarHoje: string | null; fluxoPrevisto: TarefaPrevista[] })[] {
  const arvore = arvoreDaPublicacao(base.arvore, base.catalogos, publicacao);
  return marcarCienciaRepetida(agendamentos, arvore).map(({ cienciaFica, ...resto }) => {
    const agendamento = resto as unknown as T;
    const fluxoDaTarefa = agendamento.tarefaId ? montarFluxo(agendamento.tarefaId, arvore) : null;
    // Prazo curto (ou validado noutro dia): o Enviar vai hoje e o Revisar e o Protocolar ficam antes da fatal.
    const apertada = prazoApertado(agendamento, fluxoDaTarefa, ehDiaUtil, hoje);
    return {
      ...agendamento,
      enviarHoje: apertada && apertada.enviar !== agendamento.data ? apertada.enviar : null,
      fluxoPrevisto: fluxoPrevisto(apertada ? { ...agendamento, data: apertada.enviar } : agendamento, fluxoDaTarefa, ehDiaUtil, {
        hoje,
        datas: agendamento.fluxoDatas,
        apertada,
      }).map((tarefa) =>
        tarefa.quando === "criacao" && ehCienciaDosAgendamentos(tarefa.nome) && !cienciaFica(tarefa.caminho) ? { ...tarefa, repetida: true } : tarefa
      ),
    };
  });
}
