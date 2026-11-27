/**
 * Repasse do pedido de autos entre robôs. O robô do Jus.br e o robô do tribunal (eproc, e-SAJ…) rodam
 * separados: quando o Jus.br não traz os autos e o robô do Jus.br não tem o conector da reserva, ele
 * devolve o pedido à fila já no sistema do tribunal, e o robô do tribunal o pega.
 *
 * O mesmo vale para o processo do TJRJ que o PJe ou o DCP dizem ter migrado para o eproc: o robô que não atende o
 * eproc daquele tribunal (ex.: o do Jus.br, que também atende o PJe pelo mesmo login da PDPJ) devolve o pedido à
 * fila no eproc, em vez de abrir um segundo login do advogado no eproc.
 */

/** Sistemas com robô do tribunal: os que podem receber um pedido repassado pelo robô do Jus.br. */
export const SISTEMAS_DE_REPASSE = ["eproc", "esaj", "pje", "dcp"] as const;
export type SistemaDeRepasse = (typeof SISTEMAS_DE_REPASSE)[number];

/**
 * Confere o repasse pedido pelo robô. `reserva` é o conector do tribunal ("esaj:TJSP"), o mesmo que o pedido
 * trouxe. Devolve o sistema e o tribunal de destino, ou o motivo da recusa.
 */
export function lerRepasse(pedido: { sistema: string; tribunal: string }, reserva: string): { sistema: SistemaDeRepasse; tribunal: string } | { erro: string } {
  const migrado = pedido.sistema === "pje" || pedido.sistema === "dcp";
  if (pedido.sistema !== "jusbr" && !migrado) return { erro: "Só o pedido ao Jus.br (ou o do PJe e do DCP, para o eproc) é repassado a outro robô." };
  const [sistema, tribunal, ...sobra] = reserva.trim().split(":");
  if (sobra.length || !sistema || !tribunal) return { erro: `Reserva inválida: ${reserva.slice(0, 40)}.` };
  if (!(SISTEMAS_DE_REPASSE as readonly string[]).includes(sistema)) return { erro: `Sistema desconhecido para o repasse: ${sistema.slice(0, 20)}.` };
  if (migrado && sistema !== "eproc") return { erro: `O pedido do ${pedido.sistema} só é repassado ao eproc (processo migrado).` };
  if (tribunal !== pedido.tribunal) return { erro: `A reserva (${tribunal.slice(0, 20)}) não é do tribunal do pedido (${pedido.tribunal}).` };
  return { sistema: sistema as SistemaDeRepasse, tribunal };
}
