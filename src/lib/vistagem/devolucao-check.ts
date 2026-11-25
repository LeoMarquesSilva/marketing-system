/**
 * Devolução do Check para a Vistagem (pedido de 25/11/2026, 2041725-27.2026.8.26.0000).
 *
 * No Check, depois de "Encontrei erro", a Operações Legais pode devolver a publicação para a Vistagem:
 * - o robô cancela no VIOS as tarefas que tinha agendado, com o tipo INCONSISTÊNCIA NA VISTAGEM. É uma linha por
 *   lançamento na fila do SAMA, e o robô cancela todas as CIs dele;
 * - as tarefas voltam preenchidas para o jurídico corrigir;
 * - a publicação volta para "A vistar" da área, com a faixa amarela.
 * O que estava no VIOS fica guardado em `agendamentos_cancelados`, para o Histórico e o aviso da Vistagem.
 */

/** Marca da linha de cancelamento na fila do SAMA (o robô cancela todas as tarefas do lançamento de origem). */
export const ORIGEM_DEVOLUCAO_VISTAGEM = "orquestra_devolucao";

/** Uma tarefa que estava no VIOS quando a publicação foi devolvida. */
export interface TarefaCancelada {
  tarefa: string;
  etiqueta: string;
  /** AAAA-MM-DD */
  data: string | null;
  dataFatal: string | null;
  responsavel: string | null;
  /** CIs no VIOS: a tarefa e as que o fluxo criou. */
  cis: string[];
  /** Quando o robô lançou. */
  enviadoEm: string | null;
}

/** Pedido de cancelamento ao robô: uma linha na fila do SAMA por lançamento. */
export interface PedidoDeCancelamento {
  /** Linha do lançamento na fila do SAMA (o robô lê as CIs dela). */
  origemId: string;
  /** Linha do cancelamento; null quando não deu para pedir. */
  samaId: string | null;
  cis: string[];
  erro?: string | null;
}

/** Cada devolução do Check, em `vistagem_publicacoes.agendamentos_cancelados`. */
export interface DevolucaoRegistrada {
  em: string;
  /** Id de quem devolveu. */
  por: string | null;
  motivo: string;
  inconsistenciaId: string | null;
  tarefas: TarefaCancelada[];
  cancelamentos: PedidoDeCancelamento[];
}

/** O que a linha de cancelamento na fila do SAMA diz agora. */
export type SituacaoDoCancelamento =
  | { estado: "na_fila" }
  | { estado: "cancelando" }
  | { estado: "feito"; canceladas: string[]; jaConcluidas: string[]; jaCanceladas: string[]; falhas: { ci: string; erro: string }[] }
  | { estado: "erro"; erro: string }
  | { estado: "nao_pedido"; erro: string };

/** Agendamento como sai do banco (só o que a devolução usa). */
export interface AgendamentoParaDevolver {
  tarefa: string;
  etiqueta: string;
  data: string | null;
  data_fatal: string | null;
  responsavel: string | null;
  envio_status: string;
  envio_simulado: boolean | null;
  sama_agendamento_id: string | null;
  vios_tarefa_id: string | null;
  vios_tarefas: { ci?: string | number | null }[] | null;
  enviado_em: string | null;
}

const ROBO_TRABALHANDO = new Set(["pendente", "enviado", "processando"]);

function so(ci: unknown): string {
  return String(ci ?? "").replace(/\D/g, "");
}

/** CIs da tarefa no VIOS: as do relatório do robô (com as do fluxo) e a principal, sem repetir. */
export function cisDaTarefa(agendamento: Pick<AgendamentoParaDevolver, "vios_tarefas" | "vios_tarefa_id">): string[] {
  const cis: string[] = [];
  for (const tarefa of agendamento.vios_tarefas ?? []) {
    const ci = so(tarefa?.ci);
    if (ci && !cis.includes(ci)) cis.push(ci);
  }
  const principal = so(agendamento.vios_tarefa_id);
  if (principal && !cis.includes(principal)) cis.unshift(principal);
  return cis;
}

/** Texto do erro do check, para o motivo da devolução e do cancelamento no VIOS. */
export function motivoDaDevolucao(inconsistencia: { tipo: string; subtipo?: string | null; descricao: string }): string {
  const tipo = inconsistencia.subtipo ? `${inconsistencia.tipo} (${inconsistencia.subtipo})` : inconsistencia.tipo;
  return `${tipo}: ${inconsistencia.descricao.trim()}`.slice(0, 2000);
}

/**
 * O que a devolução vai fazer com as tarefas da publicação. Recusa enquanto o robô ainda trabalha nelas. Lista as
 * tarefas que estavam no VIOS (as simuladas não contam) e os lançamentos a cancelar, um por linha da fila do SAMA.
 */
export function planoDaDevolucao(
  agendamentos: AgendamentoParaDevolver[]
): { ok: true; tarefas: TarefaCancelada[]; lancamentos: { origemId: string; cis: string[] }[] } | { ok: false; erro: string } {
  if (agendamentos.some((item) => ROBO_TRABALHANDO.has(item.envio_status))) {
    return { ok: false, erro: "O robô ainda está com tarefas desta publicação. Espere terminar para devolver." };
  }
  const noVios = agendamentos.filter((item) => item.envio_status === "concluido" && item.envio_simulado !== true);
  const tarefas = noVios.map(
    (item): TarefaCancelada => ({
      tarefa: item.tarefa,
      etiqueta: item.etiqueta,
      data: item.data,
      dataFatal: item.data_fatal,
      responsavel: item.responsavel,
      cis: cisDaTarefa(item),
      enviadoEm: item.enviado_em,
    })
  );
  const porLancamento = new Map<string, string[]>();
  for (const item of noVios) {
    if (!item.sama_agendamento_id) continue;
    const cis = porLancamento.get(item.sama_agendamento_id) ?? [];
    for (const ci of cisDaTarefa(item)) if (!cis.includes(ci)) cis.push(ci);
    porLancamento.set(item.sama_agendamento_id, cis);
  }
  return { ok: true, tarefas, lancamentos: [...porLancamento].map(([origemId, cis]) => ({ origemId, cis })) };
}

/** Linha da fila do SAMA (status, erro e resultado do robô). */
export interface LinhaDoCancelamento {
  status: string;
  erro: string | null;
  resultado: {
    canceladas?: unknown[];
    ja_concluidas?: unknown[];
    ja_canceladas?: unknown[];
    falhas?: { ci?: unknown; erro?: unknown }[];
    ci_vios?: unknown;
  } | null;
}

/** A situação de um pedido de cancelamento, pela linha da fila do SAMA. */
export function situacaoDoCancelamento(pedido: PedidoDeCancelamento, linha: LinhaDoCancelamento | null | undefined): SituacaoDoCancelamento {
  if (!pedido.samaId) return { estado: "nao_pedido", erro: pedido.erro || "O pedido ao robô não foi feito." };
  if (!linha) return { estado: "erro", erro: "O pedido sumiu da fila do robô." };
  if (linha.status === "pendente" || linha.status === "enviado") return { estado: "na_fila" };
  if (linha.status === "processando") return { estado: "cancelando" };
  if (linha.status === "erro") return { estado: "erro", erro: linha.erro || "O robô não conseguiu cancelar." };
  const r = linha.resultado ?? {};
  const lista = (valores: unknown[] | undefined) => (valores ?? []).map(so).filter(Boolean);
  // Resultado sem as listas (robô de antes da devolução): o CI principal cancelado.
  const temListas = Array.isArray(r.canceladas) || Array.isArray(r.falhas);
  return {
    estado: "feito",
    canceladas: temListas ? lista(r.canceladas) : [so(r.ci_vios)].filter(Boolean),
    jaConcluidas: lista(r.ja_concluidas),
    jaCanceladas: lista(r.ja_canceladas),
    falhas: (r.falhas ?? []).map((falha) => ({ ci: so(falha?.ci), erro: String(falha?.erro ?? "") })).filter((falha) => falha.ci),
  };
}

/** Uma linha por pedido, para o aviso da Vistagem e o Histórico. */
export function textoDaSituacao(situacao: SituacaoDoCancelamento, cis: string[]): string {
  const ciS = (lista: string[]) => `CI ${lista.join(", ")}`;
  switch (situacao.estado) {
    case "na_fila":
      return `Cancelamento no VIOS na fila do robô: ${ciS(cis)}.`;
    case "cancelando":
      return `O robô está cancelando no VIOS: ${ciS(cis)}.`;
    case "erro":
      return `O robô não cancelou (${situacao.erro}). Cancele à mão no VIOS: ${ciS(cis)}.`;
    case "nao_pedido":
      return `Não deu para pedir o cancelamento ao robô (${situacao.erro}). Cancele à mão no VIOS: ${ciS(cis)}.`;
    case "feito": {
      const partes = [
        situacao.canceladas.length ? `canceladas ${ciS(situacao.canceladas)}` : null,
        situacao.jaCanceladas.length ? `já estavam canceladas ${ciS(situacao.jaCanceladas)}` : null,
        situacao.jaConcluidas.length ? `já concluídas, ficaram como estão: ${ciS(situacao.jaConcluidas)}` : null,
        situacao.falhas.length ? `não canceladas, cancele à mão: ${situacao.falhas.map((falha) => `CI ${falha.ci} (${falha.erro})`).join("; ")}` : null,
      ].filter(Boolean);
      return `Cancelamento no VIOS: ${partes.join("; ") || "nada a cancelar"}.`;
    }
  }
}

/** A devolução está pendente no jurídico (ainda não vistada de novo nem reaberta)? */
export function devolucaoPendente(publicacao: { status: string; devolvidoEm: string | null; revistadoEm: string | null; reabertaEm?: string | null }): boolean {
  if (publicacao.status !== "juridico_vistar" || !publicacao.devolvidoEm) return false;
  if (publicacao.revistadoEm && publicacao.revistadoEm > publicacao.devolvidoEm) return false;
  if (publicacao.reabertaEm && publicacao.reabertaEm > publicacao.devolvidoEm) return false;
  return true;
}
