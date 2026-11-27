import { local, somarDias } from "./agenda";
import { tribunalDoCnj } from "./conferencia-vios";
import { cnjComMascara, horaLocalParaIso, tipoDaDescricao } from "./pje";
import type { Audiencia, Modalidade, TipoAudiencia } from "./tipos";
import { ehTarefaDeAudiencia, type AudienciaNoVios } from "./vios-csv";

/**
 * Rede de segurança da pauta (parte sem banco). Nada que a equipe rastreia pode ficar de fora, e o robô só lê a Minha
 * Pauta do 1º grau dos tribunais dele: sessão de 2º grau, perícia, audiência de outro TRT e processo fora da Minha
 * Pauta não aparecem lá. Então a tarefa aberta do VIOS (audiência, sessão ou perícia) e o agendamento de audiência da
 * Vistagem que o tribunal ainda não mostrou entram na pauta "a confirmar no tribunal", com origem "vios":
 * - chave "vios:<CI da tarefa>"; agendamento da Vistagem que ainda não chegou ao VIOS: "vistagem:<id do agendamento>"
 *   (quando ganha a CI, passa a "vios:<CI>", a mesma chave da tarefa);
 * - só da área trabalhista, de hoje até 60 dias; audiência de um tribunal que o robô lê, só até onde ele leu (depois
 *   disso o robô ainda não olhou);
 * - quando o tribunal (PJe ou Jus.br) passa a mostrar a audiência, a do tribunal vale e herda a dupla.
 * Medido em 24/11/2026, nos 60 dias: 7 audiências de outros TRTs, 21 sessões e 23 perícias só estavam no VIOS.
 */

export const DIAS_DA_RESERVA = 60;

export interface ItemDeReserva {
  chave: string;
  fonte: "vios" | "vistagem";
  cnj: string;
  /** Início; na sessão virtual, o primeiro dia. */
  inicio: string;
  /** Último dia (aaaa-mm-dd): o fim da sessão virtual, ou o próprio dia. */
  ultimoDia: string;
  tipo: TipoAudiencia;
  tipoDescricao: string;
  modalidade: Modalidade | null;
  viosTarefaCi: string | null;
  viosInicio: string | null;
  ciProcesso: string | null;
}

export interface CriteriosDaReserva {
  hoje: string;
  /** Até onde o robô leu cada tribunal (lidoAtePorTribunal). */
  lidoAte: Map<string, string>;
}

/** Um agendamento de audiência, sessão ou perícia da Vistagem, com o processo da publicação. */
export interface AgendamentoDeAudiencia {
  id: string;
  tarefa: string;
  /** aaaa-mm-dd: data para conclusão (na sessão virtual, o primeiro dia). */
  data: string;
  /** aaaa-mm-dd: data limite no VIOS (na sessão virtual, o último dia). */
  dataLimite: string | null;
  hora: string | null;
  viosTarefaCi: string | null;
  cnj: string | null;
  area: string | null;
  ciProcesso: string | null;
}

/**
 * A pauta é da equipe trabalhista: processo da Justiça do Trabalho (".5." no número) e, quando a fonte diz a área,
 * área trabalhista. (Na 1ª simulação, 24/11/2026, uma sessão do TJ-SC veio de uma publicação sem área.)
 */
export function ehTrabalhista(area: string | null | undefined, cnj?: string | null): boolean {
  if (cnj !== undefined && cnj !== null && cnj.split(".")[2] !== "5") return false;
  return !area || /trabalh/i.test(area);
}

/** Tipo que a Minha Pauta do PJe mostra: se o processo estiver nela, o robô acha. */
function oRoboLe(tipo: TipoAudiencia): boolean {
  return tipo !== "sessao" && tipo !== "pericia";
}

function ddmm(dia: string): string {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

function descricao(tarefa: string, primeiroDia: string, ultimoDia: string): string {
  return ultimoDia !== primeiroDia ? `${tarefa} (até ${ddmm(ultimoDia)})` : tarefa;
}

export function itemDoVios(t: AudienciaNoVios): ItemDeReserva {
  const inicio = t.conclusao ?? t.inicio;
  const ultimoDia = local(t.inicio).dia;
  return {
    chave: `vios:${t.tarefaCi}`,
    fonte: "vios",
    cnj: t.cnj,
    inicio,
    ultimoDia,
    tipo: t.tipo,
    tipoDescricao: descricao(t.tarefa, local(inicio).dia, ultimoDia),
    modalidade: t.tipo === "pericia" ? "presencial" : null,
    viosTarefaCi: t.tarefaCi,
    viosInicio: inicio,
    ciProcesso: t.ciProcesso,
  };
}

export function itemDaVistagem(a: AgendamentoDeAudiencia): ItemDeReserva | null {
  const tarefa = a.tarefa.trim();
  const cnj = cnjComMascara(a.cnj);
  if (!cnj || !ehTarefaDeAudiencia(tarefa) || !ehTrabalhista(a.area, cnj)) return null;
  const dia = a.data.slice(0, 10);
  const h = (a.hora ?? "").match(/(\d{1,2}):(\d{2})/);
  const inicio = horaLocalParaIso(`${dia}T${h ? h[1]!.padStart(2, "0") : "00"}:${h ? h[2] : "00"}:00`);
  if (!inicio) return null;
  const limite = (a.dataLimite ?? "").slice(0, 10);
  const ultimoDia = limite > dia ? limite : dia;
  const tipo = tipoDaDescricao(tarefa.replace(/AUD\./i, "audiência"));
  const ci = a.viosTarefaCi?.trim() || null;
  return {
    chave: ci ? `vios:${ci}` : `vistagem:${a.id}`,
    fonte: "vistagem",
    cnj,
    inicio,
    ultimoDia,
    tipo,
    tipoDescricao: descricao(tarefa, dia, ultimoDia),
    modalidade: tipo === "pericia" ? "presencial" : null,
    viosTarefaCi: ci,
    viosInicio: ci ? inicio : null,
    ciProcesso: a.ciProcesso,
  };
}

/** Entra agora? Ainda não acabou e começa em até 60 dias; audiência de tribunal que o robô lê, só até onde ele leu. */
export function noHorizonte(item: Pick<ItemDeReserva, "cnj" | "inicio" | "ultimoDia" | "tipo">, crit: CriteriosDaReserva): boolean {
  const dia = local(item.inicio).dia;
  if (item.ultimoDia < crit.hoje || dia > somarDias(crit.hoje, DIAS_DA_RESERVA)) return false;
  const lido = oRoboLe(item.tipo) ? crit.lidoAte.get(tribunalDoCnj(item.cnj) ?? "") : undefined;
  return !lido || dia <= lido;
}

/** Tarefas abertas e trabalhistas do VIOS que nenhuma audiência do tribunal tomou para si na conferência. */
export function reservasDoVios(tarefas: AudienciaNoVios[], usadas: Set<string>, crit: CriteriosDaReserva): ItemDeReserva[] {
  return tarefas
    .filter((t) => t.status === "aberta" && Boolean(t.cnj) && ehTrabalhista(t.area, t.cnj) && !usadas.has(t.tarefaCi))
    .map(itemDoVios)
    .filter((i) => noHorizonte(i, crit));
}

function grupo(tipo: TipoAudiencia): string {
  return tipo === "sessao" || tipo === "pericia" ? tipo : "audiencia";
}

/**
 * Um item por audiência. Mesma chave: vale o do VIOS. Agendamento da Vistagem ainda sem CI que o VIOS já tem (mesmo
 * processo, dia e grupo): sai. E sai o que o tribunal já mostra no mesmo dia (perícia o tribunal não mostra).
 */
export function juntarReservas(
  doVios: ItemDeReserva[],
  daVistagem: ItemDeReserva[],
  tribunal: Pick<Audiencia, "cnj" | "inicio" | "situacao" | "origem">[]
): ItemDeReserva[] {
  const porChave = new Map<string, ItemDeReserva>();
  for (const i of doVios) porChave.set(i.chave, i);
  const doViosNoDia = new Set(doVios.map((i) => `${i.cnj}|${local(i.inicio).dia}|${grupo(i.tipo)}`));
  for (const i of daVistagem) {
    if (porChave.has(i.chave)) continue;
    if (!i.viosTarefaCi && doViosNoDia.has(`${i.cnj}|${local(i.inicio).dia}|${grupo(i.tipo)}`)) continue;
    porChave.set(i.chave, i);
  }
  const noTribunal = new Set(tribunal.filter((a) => a.origem !== "vios" && a.situacao === "designada").map((a) => `${a.cnj}|${local(a.inicio).dia}`));
  return [...porChave.values()]
    .filter((i) => i.tipo === "pericia" || !noTribunal.has(`${i.cnj}|${local(i.inicio).dia}`))
    .sort((x, y) => x.inicio.localeCompare(y.inicio));
}

/**
 * Audiência "a confirmar" que o tribunal passou a mostrar: a tarefa dela casou com uma audiência do PJe ou do Jus.br
 * na conferência, ou o tribunal tem audiência do mesmo processo no mesmo dia (perícia não: o tribunal não mostra
 * perícia, e audiência no mesmo dia é outra coisa). A do tribunal passa a valer.
 */
export function reservasComTribunal(audiencias: Audiencia[], tribunalDaTarefa: Map<string, Audiencia>): { reserva: Audiencia; tribunal: Audiencia }[] {
  const doDia = new Map<string, Audiencia>();
  for (const a of audiencias) if (a.origem !== "vios" && a.situacao === "designada") doDia.set(`${a.cnj}|${local(a.inicio).dia}`, a);
  const pares: { reserva: Audiencia; tribunal: Audiencia }[] = [];
  for (const a of audiencias) {
    if (a.origem !== "vios" || a.situacao !== "designada") continue;
    const pelaTarefa = a.viosTarefaCi ? tribunalDaTarefa.get(a.viosTarefaCi) : undefined;
    const tribunal = pelaTarefa ?? (a.tipo === "pericia" ? undefined : doDia.get(`${a.cnj}|${local(a.inicio).dia}`));
    if (tribunal) pares.push({ reserva: a, tribunal });
  }
  return pares;
}

/**
 * Por que uma audiência "a confirmar" sai da pauta (null = fica): a tarefa foi cancelada no VIOS, foi concluída antes
 * da data, sumiu do VIOS (só quando o Audiencias.csv, que é completo, foi lido) ou o agendamento saiu da Vistagem.
 */
export function motivoParaSair(
  a: Pick<Audiencia, "chave" | "inicio" | "situacao">,
  ctx: { tarefasPorCi: Map<string, AudienciaNoVios>; agendamentos: Set<string>; relatorioCompleto: boolean; agora: Date }
): string | null {
  if (a.situacao !== "designada") return null;
  if (a.chave.startsWith("vios:")) {
    const t = ctx.tarefasPorCi.get(a.chave.slice("vios:".length));
    if (!t) return ctx.relatorioCompleto ? "a tarefa não está mais no VIOS" : null;
    if (t.status === "cancelada") return "tarefa cancelada no VIOS";
    if (t.status === "concluida" && new Date(a.inicio).getTime() > ctx.agora.getTime()) return "tarefa concluída no VIOS antes da data";
    return null;
  }
  if (a.chave.startsWith("vistagem:")) return ctx.agendamentos.has(a.chave.slice("vistagem:".length)) ? null : "o agendamento saiu da Vistagem";
  return null;
}

/** O que vai ao Jus.br: o robô consulta o processo e lê os movimentos de audiência. */
export interface ConsultaJusbr {
  cnj: string;
  inicio: string;
  tarefaCi: string;
  tarefa: string;
}

/**
 * Audiências "a confirmar" de tribunal que o robô não consegue ler: sem leitura recente do PJe. Em 27/11/2026, o TRT-5
 * barrava o servidor e o WARP, e o TRT-17 às vezes negava o login. Elas vão ao Jus.br, que é nacional e confirma a data;
 * pelos movimentos do processo ele também pega remarcação e cancelamento. Sessão e perícia ficam de fora, porque os
 * movimentos que o robô lê no Jus.br são de audiência.
 */
export function reservasParaOJusbr(
  audiencias: Pick<Audiencia, "cnj" | "inicio" | "tipo" | "tipoDescricao" | "situacao" | "origem" | "viosTarefaCi">[],
  tribunaisLidos: Set<string>,
  agora: Date
): ConsultaJusbr[] {
  return audiencias
    .filter((a) => a.origem === "vios" && a.situacao === "designada" && a.tipo !== "sessao" && a.tipo !== "pericia")
    .filter((a) => Date.parse(a.inicio) >= agora.getTime() && !tribunaisLidos.has(tribunalDoCnj(a.cnj) ?? ""))
    .map((a) => ({ cnj: a.cnj, inicio: a.inicio, tarefaCi: a.viosTarefaCi ?? "", tarefa: a.tipoDescricao || a.tipo }));
}
