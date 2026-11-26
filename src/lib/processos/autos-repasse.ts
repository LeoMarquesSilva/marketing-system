/**
 * Repasse do pedido de autos entre robôs. O robô do Jus.br e o robô do tribunal (eproc, e-SAJ…) rodam
 * separados: quando o Jus.br não traz os autos e o robô do Jus.br não tem o conector da reserva, ele
 * devolve o pedido à fila já no sistema do tribunal, e o robô do tribunal o pega.
 */

/** Sistemas com robô do tribunal: os que podem receber um pedido repassado pelo robô do Jus.br. */
export const SISTEMAS_DE_REPASSE = ["eproc", "esaj", "pje", "dcp"] as const;
export type SistemaDeRepasse = (typeof SISTEMAS_DE_REPASSE)[number];

/**
 * Confere o repasse pedido pelo robô. `reserva` é o conector do tribunal ("esaj:TJSP"), o mesmo que o pedido
 * trouxe. Devolve o sistema e o tribunal de destino, ou o motivo da recusa.
 */
export function lerRepasse(pedido: { sistema: string; tribunal: string }, reserva: string): { sistema: SistemaDeRepasse; tribunal: string } | { erro: string } {
  if (pedido.sistema !== "jusbr") return { erro: "Só o pedido ao Jus.br é repassado ao robô do tribunal." };
  const [sistema, tribunal, ...sobra] = reserva.trim().split(":");
  if (sobra.length || !sistema || !tribunal) return { erro: `Reserva inválida: ${reserva.slice(0, 40)}.` };
  if (!(SISTEMAS_DE_REPASSE as readonly string[]).includes(sistema)) return { erro: `Sistema desconhecido para o repasse: ${sistema.slice(0, 20)}.` };
  if (tribunal !== pedido.tribunal) return { erro: `A reserva (${tribunal.slice(0, 20)}) não é do tribunal do pedido (${pedido.tribunal}).` };
  return { sistema: sistema as SistemaDeRepasse, tribunal };
}
