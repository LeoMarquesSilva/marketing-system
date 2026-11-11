/**
 * Alterar a vistagem depois de vistar (pedido de 11/11/2026): enquanto a controladoria não agiu na Conferência, quem
 * vistou pode reabrir a publicação, que volta para "A vistar" com as tarefas como estão. Se a controladoria estiver
 * conferindo ao mesmo tempo, vale a decisão dela: a publicação aberta na Conferência fica "segura" por alguns minutos
 * (o navegador da controladoria renova enquanto ela estiver na tela), e nesse tempo não dá para reabrir.
 */

/** Quanto tempo a publicação fica segura depois que a controladoria abre (ou ajusta) na Conferência. */
export const CONFERENCIA_SEGURA_MS = 10 * 60_000;
/** De quanto em quanto tempo a tela da Conferência renova a marca da publicação aberta. */
export const RENOVAR_CONFERENCIA_MS = 4 * 60_000;

export interface SituacaoDaVistagem {
  status: string;
  /** Quem vistou por último: quem vistou de novo depois da devolução ou, sem devolução, quem vistou. */
  quemVistou: string | null;
  /** Alguma tarefa já foi ajustada pela controladoria na Conferência (lápis). */
  ajustada: boolean;
  /** Quando a controladoria abriu ou ajustou a publicação na Conferência pela última vez. */
  conferenciaAbertaEm: string | null;
}

export type AlteracaoDaVistagem = { pode: true } | { pode: false; texto: string };

/** A controladoria está com a publicação aberta na Conferência agora. */
export function emConferencia(conferenciaAbertaEm: string | null | undefined, agora: number): boolean {
  if (!conferenciaAbertaEm) return false;
  const aberta = Date.parse(conferenciaAbertaEm);
  return Number.isFinite(aberta) && agora - aberta < CONFERENCIA_SEGURA_MS;
}

/** Limite da marca: a publicação aberta na Conferência depois disto ainda está segura. */
export function inicioDaConferenciaSegura(agora: number): string {
  return new Date(agora - CONFERENCIA_SEGURA_MS).toISOString();
}

/** Se a pessoa pode reabrir a vistagem para alterar e, se não, por quê (em português, para a tela). */
export function alteracaoDaVistagem(situacao: SituacaoDaVistagem, authUserId: string, agora: number): AlteracaoDaVistagem {
  if (situacao.status !== "controladoria_vistar") return { pode: false, texto: "A controladoria já conferiu esta vistagem." };
  if (!situacao.quemVistou || situacao.quemVistou !== authUserId) return { pode: false, texto: "Só quem vistou pode alterar a vistagem." };
  if (situacao.ajustada) {
    return { pode: false, texto: "A controladoria já ajustou esta vistagem na Conferência. Para mudar, peça que ela devolva." };
  }
  if (emConferencia(situacao.conferenciaAbertaEm, agora)) {
    return { pode: false, texto: "A controladoria está conferindo esta publicação agora, e a decisão dela vale. Para mudar, fale com ela." };
  }
  return { pode: true };
}

/** Reaberta pelo jurídico depois da última devolução: a vistagem mostra o aviso de alteração, não o da devolução. */
export function reabertaParaAlterar(publicacao: { reabertaEm: string | null; devolvidoEm: string | null }): boolean {
  if (!publicacao.reabertaEm) return false;
  return !publicacao.devolvidoEm || publicacao.reabertaEm > publicacao.devolvidoEm;
}
