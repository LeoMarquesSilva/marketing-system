import { chaveNome, nomesDasPessoas, revisorFicaNaTarefa } from "./agendamento";
import { ehCienciaDosAgendamentos, ehCienciaNf } from "./ciencia-agendamentos";
import type { TarefaNoVios } from "./fila-vios";
import type { AgendamentoResumo, ConferenciaItem } from "./types";

/**
 * Check dos agendamentos: o que o jurídico pediu (e a conferência validou) × o que o robô gravou no VIOS.
 *
 * Só vira divergência o que o robô devolveu e ficou diferente do pedido. O que o robô não devolve (o horário,
 * por exemplo, ainda vem vazio) não é deduzido: fica "conferir no VIOS".
 */

/** Como um campo pedido ficou no VIOS. `sem_dado`: o robô não devolveu o valor; a controladoria confere no VIOS. */
export type SituacaoCampo = "confere" | "diverge" | "sem_dado";

/** Situação da tarefa (e da publicação) no check. `conferir`: nada diverge, mas falta algum dado do robô. */
export type SituacaoCheck = "confere" | "diverge" | "conferir";

export interface CampoNoVios {
  /** AAAA-MM-DD ou HH:MM. */
  pedido: string | null;
  noVios: string | null;
  situacao: SituacaoCampo;
}

export interface ResponsavelNoVios {
  pedido: string[];
  noVios: string[];
  /** Pedidos que não estão entre os responsáveis no VIOS. */
  faltando: string[];
  /** No VIOS sem terem sido pedidos (informativo: o tipo pode ter responsável fixo). */
  aMais: string[];
  situacao: SituacaoCampo;
}

/** Data do fluxo escolhida pelo jurídico (o robô grava no VIOS depois de lançar) e as datas gravadas com aquele nome. */
export interface DataDoFluxoNoVios {
  nome: string;
  caminho: string[];
  pedido: string;
  /** Datas das tarefas gravadas com o mesmo nome (pode haver duas "2. REVISAR"). */
  noVios: string[];
  situacao: SituacaoCampo;
}

export type CampoDivergente = "data" | "hora" | "responsavel" | "fluxo";

export interface Divergencia {
  campo: CampoDivergente;
  /** Frase curta: "data pedida 09/11/2026, no VIOS 10/11/2026". */
  texto: string;
}

export interface ComparacaoDaTarefa {
  /** A tarefa pedida como o robô a gravou; null quando o robô não devolveu como ficou no VIOS. */
  gravada: TarefaNoVios | null;
  ci: string | null;
  data: CampoNoVios;
  /** Só quando há horário pedido (Compromisso). */
  hora: CampoNoVios | null;
  responsavel: ResponsavelNoVios;
  datasDoFluxo: DataDoFluxoNoVios[];
  divergencias: Divergencia[];
  situacao: SituacaoCheck;
}

/** "2026-11-09" → "09/11/2026". */
export function dataBr(iso: string | null): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

/** "9:30", "09:30:00" → "09:30"; outro formato fica como veio. */
function horaCurta(hora: string | null): string | null {
  const texto = hora?.trim();
  if (!texto) return null;
  const m = texto.match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : texto;
}

function comparar(pedido: string | null, noVios: string | null): SituacaoCampo {
  if (!noVios) return "sem_dado";
  return pedido === noVios ? "confere" : "diverge";
}

/** A pedida e as que o fluxo criou junto, como o robô devolveu; a pedida é a marcada como principal. */
function principalDe(agendamento: AgendamentoResumo): TarefaNoVios | null {
  return (agendamento.viosTarefas ?? []).find((tarefa) => tarefa.principal) ?? null;
}

function compararResponsavel(pedidoTexto: string, gravada: TarefaNoVios | null): ResponsavelNoVios {
  const pedido = nomesDasPessoas(pedidoTexto);
  const noVios = nomesDasPessoas(gravada?.responsaveis);
  const chavesNoVios = new Set(noVios.map(chaveNome));
  const chavesPedido = new Set(pedido.map(chaveNome));
  const faltando = pedido.filter((nome) => !chavesNoVios.has(chaveNome(nome)));
  const aMais = noVios.filter((nome) => !chavesPedido.has(chaveNome(nome)));
  return { pedido, noVios, faltando, aMais, situacao: !noVios.length ? "sem_dado" : faltando.length ? "diverge" : "confere" };
}

/**
 * Sessão de Julgamento: o revisor está na tarefa que o robô gravou? Null nas outras tarefas e quando o robô não devolveu
 * os responsáveis. Não vira divergência: o que o robô devolveu é como a tarefa ficou no lançamento, e quem incluir o
 * revisor depois, no VIOS, não apareceria aqui.
 */
export function revisorEstaNaTarefa(agendamento: AgendamentoResumo): boolean | null {
  if (!agendamento.revisor || !revisorFicaNaTarefa(agendamento.tarefa)) return null;
  const noVios = nomesDasPessoas(principalDe(agendamento)?.responsaveis);
  if (!noVios.length) return null;
  return noVios.some((nome) => chaveNome(nome) === chaveNome(agendamento.revisor));
}

function compararDatasDoFluxo(agendamento: AgendamentoResumo): DataDoFluxoNoVios[] {
  const doFluxo = (agendamento.viosTarefas ?? []).filter((tarefa) => !tarefa.principal);
  // Só as datas: o responsável escolhido no fluxo o robô confere e avisa no resultado.
  return (agendamento.fluxoDatas ?? []).flatMap((pedida) => {
    const pedido = pedida.data;
    if (!pedido) return [];
    const nome = pedida.caminho[pedida.caminho.length - 1] ?? "";
    const noVios = doFluxo
      .filter((tarefa) => chaveNome(tarefa.tipo) === chaveNome(nome))
      .map((tarefa) => tarefa.data)
      .filter((data): data is string => Boolean(data));
    const situacao: SituacaoCampo = !noVios.length ? "sem_dado" : noVios.includes(pedido) ? "confere" : "diverge";
    return [{ nome, caminho: pedida.caminho, pedido, noVios, situacao }];
  });
}

/** O pedido × o que o robô gravou no VIOS, campo a campo, para uma tarefa da vistagem. */
export function compararTarefa(agendamento: AgendamentoResumo): ComparacaoDaTarefa {
  const gravada = principalDe(agendamento);
  const data: CampoNoVios = { pedido: agendamento.data || null, noVios: gravada?.data ?? null, situacao: comparar(agendamento.data || null, gravada?.data ?? null) };
  const horaPedida = horaCurta(agendamento.hora);
  const horaNoVios = horaCurta(gravada?.hora ?? null);
  const hora: CampoNoVios | null = horaPedida ? { pedido: horaPedida, noVios: horaNoVios, situacao: comparar(horaPedida, horaNoVios) } : null;
  const responsavel = compararResponsavel(agendamento.responsavel, gravada);
  const datasDoFluxo = compararDatasDoFluxo(agendamento);

  const divergencias: Divergencia[] = [];
  if (data.situacao === "diverge") divergencias.push({ campo: "data", texto: `data pedida ${dataBr(data.pedido)}, no VIOS ${dataBr(data.noVios)}` });
  if (hora?.situacao === "diverge") divergencias.push({ campo: "hora", texto: `horário pedido ${hora.pedido}, no VIOS ${hora.noVios}` });
  if (responsavel.situacao === "diverge") {
    divergencias.push({
      campo: "responsavel",
      texto: `responsável pedido ${responsavel.pedido.join(", ")}, no VIOS ${responsavel.noVios.join(", ")}`,
    });
  }
  for (const doFluxo of datasDoFluxo) {
    if (doFluxo.situacao === "diverge") {
      divergencias.push({ campo: "fluxo", texto: `${doFluxo.nome}: data pedida ${dataBr(doFluxo.pedido)}, no VIOS ${doFluxo.noVios.map(dataBr).join(" e ")}` });
    }
  }

  const faltaDado =
    !gravada ||
    data.situacao === "sem_dado" ||
    hora?.situacao === "sem_dado" ||
    responsavel.situacao === "sem_dado" ||
    datasDoFluxo.some((doFluxo) => doFluxo.situacao === "sem_dado");
  return {
    gravada,
    ci: gravada?.ci ?? agendamento.viosTarefaId,
    data,
    hora,
    responsavel,
    datasDoFluxo,
    divergencias,
    situacao: divergencias.length ? "diverge" : faltaDado ? "conferir" : "confere",
  };
}

/** A pior situação entre as tarefas: uma divergente basta; sem divergência, falta de dado pede conferir no VIOS. */
export function situacaoDoCheck(item: Pick<ConferenciaItem, "agendamentos">): SituacaoCheck {
  const situacoes = item.agendamentos.map((agendamento) => compararTarefa(agendamento).situacao);
  if (situacoes.includes("diverge")) return "diverge";
  if (!situacoes.length || situacoes.includes("conferir")) return "conferir";
  return "confere";
}

export const temDivergencia = (item: Pick<ConferenciaItem, "agendamentos">) => situacaoDoCheck(item) === "diverge";

/** Subtipo da inconsistência (BKP) que a divergência sugere; null quando não há o que sugerir. */
export function subtipoSugerido(campos: CampoDivergente[]): string | null {
  if (campos.some((campo) => campo === "data" || campo === "hora" || campo === "fluxo")) return "DATA / HORÁRIO - (P/A)";
  if (campos.includes("responsavel")) return "RESPONSÁVEL - (P/A)";
  return null;
}

/**
 * Texto inicial de "O que está errado": uma linha por tarefa divergente, com o número dela na publicação e o CI.
 * `ids`: só estas tarefas (a pessoa apontou a divergência de um cartão). A pessoa revisa antes de salvar.
 */
export function descricaoSugerida(agendamentos: AgendamentoResumo[], ids?: string[]): string {
  const total = agendamentos.length;
  return agendamentos
    .map((agendamento, indice) => {
      if (ids && !ids.includes(agendamento.id)) return null;
      const comparacao = compararTarefa(agendamento);
      if (!comparacao.divergencias.length) return null;
      const quem = `${total > 1 ? `Tarefa ${indice + 1} · ` : ""}${agendamento.tarefa}${comparacao.ci ? ` (CI ${comparacao.ci})` : ""}`;
      return `${quem}: ${comparacao.divergencias.map((divergencia) => divergencia.texto).join("; ")}.`;
    })
    .filter(Boolean)
    .join("\n");
}

/** Tipo de agendamento para o filtro do Check: a Ciência NF à parte; as outras pela classe (Prazo, Providência, Compromisso). */
export type TipoDeAgendamento = "CIENCIA_NF" | "PRAZO" | "PROVIDENCIA" | "COMPROMISSO";

export const TIPOS_DE_AGENDAMENTO: { valor: TipoDeAgendamento; rotulo: string; descricao: string }[] = [
  { valor: "CIENCIA_NF", rotulo: "Ciência NF", descricao: "Ciência de publicação não fatal" },
  { valor: "PRAZO", rotulo: "Prazo", descricao: "Com data fatal" },
  { valor: "PROVIDENCIA", rotulo: "Providência", descricao: "Sem a Ciência NF e a Ciência dos Agendamentos" },
  { valor: "COMPROMISSO", rotulo: "Compromisso", descricao: "Audiência, sessão de julgamento, perícia…" },
];

/**
 * Tipos de agendamento da publicação. A 1. CIÊNCIA DOS AGENDAMENTOS não conta: o Orquestra cria em quase todas, e
 * ela faria quase toda publicação aparecer em "Providência".
 */
export function tiposDoItem(item: Pick<ConferenciaItem, "agendamentos">): TipoDeAgendamento[] {
  const tipos = new Set<TipoDeAgendamento>();
  for (const agendamento of item.agendamentos) {
    if (ehCienciaDosAgendamentos(agendamento.tarefa)) continue;
    tipos.add(ehCienciaNf(agendamento.tarefa) ? "CIENCIA_NF" : agendamento.etiqueta);
  }
  return TIPOS_DE_AGENDAMENTO.map((tipo) => tipo.valor).filter((tipo) => tipos.has(tipo));
}
