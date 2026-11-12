import "server-only";

import { areaDoCatalogo, chaveDoCaminho, contagemPadraoDaArea } from "./agendamento";
import { cienciaQueFica, ehCienciaDosAgendamentos } from "./ciencia-agendamentos";
import { criarCalendario, criarCalendarioDePrazo } from "./dias-uteis";
import { carregarFeriados } from "./feriados";
import { fluxoDoPrazo, fluxoPrevisto, prazoApertado, type PrazoDaPublicacao } from "./fluxo-previsto";
import { arvoreDaArea, montarFluxo, type TipoNaArvore } from "./fluxo-vios";
import { carregarArvoreVios, carregarCatalogoProcessos, catalogoDaArea, type CatalogoArea } from "./sama";
import type { AgendamentoResumo, TarefaPrevista } from "./types";

/**
 * O que decide a lista de tarefas (e a árvore) de uma publicação: a área da pasta ou, sem ela, a do escritório. A data
 * da publicação conta o prazo marcado no calendário (regra da insolvência, `fluxoDoPrazo`).
 */
export type AreaDaPublicacao = { area_processo: string | null; escritorio_responsavel: string | null; data_publicacao?: string | null };

export function catalogoDaPublicacao(areas: CatalogoArea[], publicacao: AreaDaPublicacao): CatalogoArea | null {
  return catalogoDaArea(areas, areaDoCatalogo(publicacao.area_processo, publicacao.escritorio_responsavel, areas.map((item) => item.area)));
}

/**
 * Como contar o prazo marcado com a fatal no calendário: o dia da publicação e a contagem padrão da área, como a tela
 * da vistagem (o escritório ou, sem ele, a área do catálogo).
 */
export function prazoDaPublicacao(publicacao: AreaDaPublicacao, areas: CatalogoArea[], feriados: string[]): PrazoDaPublicacao {
  return {
    dataPublicacao: publicacao.data_publicacao ?? null,
    contagem: contagemPadraoDaArea(publicacao.escritorio_responsavel ?? catalogoDaPublicacao(areas, publicacao)?.area),
    ehDiaDePrazo: criarCalendarioDePrazo(feriados),
  };
}

/**
 * A árvore do VIOS como vale para a pasta da publicação: só os tipos da lista de tarefas da área dela e, na
 * Insolvência e na Cível | Insolvência, a antecipação do Enviar e do Revisar (`ANTECIPACAO_INSOLVENCIA`).
 */
export function arvoreDaPublicacao(arvore: Map<number, TipoNaArvore>, areas: CatalogoArea[], publicacao: AreaDaPublicacao): Map<number, TipoNaArvore> {
  const catalogo = catalogoDaPublicacao(areas, publicacao);
  return arvoreDaArea(arvore, catalogo?.etapas.map((etapa) => etapa.id) ?? null, catalogo?.area ?? null);
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

type TarefaParaPrever = Pick<AgendamentoResumo, "id" | "ordem" | "tarefa" | "tarefaId" | "etiqueta" | "data" | "dataFatal" | "responsavel" | "revisor" | "fluxoDatas"> &
  Partial<Pick<AgendamentoResumo, "diasPrazo">>;

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
  const daPublicacao = prazoDaPublicacao(publicacao, base.catalogos, base.feriados);
  return marcarCienciaRepetida(agendamentos, arvore).map(({ cienciaFica, ...resto }) => {
    const agendamento = resto as unknown as T;
    const fluxoDaTarefa = agendamento.tarefaId ? fluxoDoPrazo(montarFluxo(agendamento.tarefaId, arvore), agendamento, daPublicacao) : null;
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
