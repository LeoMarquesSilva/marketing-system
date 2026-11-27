import { FalhaDoConector, MigradoParaEproc } from "./conectores/tipos.ts";
import type { Pedido } from "./fila.ts";

/**
 * O que fazer quando o Jus.br não traz os autos (tribunal ainda não integrado, documentos incompletos,
 * instabilidade) e o pedido tem reserva, o conector do tribunal ("esaj:TJSP"):
 *   - "seguir": este robô tem o conector da reserva e segue por ele no mesmo pedido;
 *   - "repassar": não tem (o robô do Jus.br roda separado do robô do tribunal); o pedido volta à fila no
 *     sistema da reserva, para o robô do tribunal.
 * Nulo quando não há reserva a usar: o erro segue como erro do pedido.
 */
export type PlanoDaReserva<C> = { tipo: "seguir"; reserva: string; conector: C } | { tipo: "repassar"; reserva: string };

export function planoDaReserva<C extends { chave: string }>(pedido: Pick<Pedido, "sistema" | "reserva">, erro: unknown, conectores: readonly C[]): PlanoDaReserva<C> | null {
  if (pedido.sistema !== "jusbr" || !pedido.reserva || !(erro instanceof FalhaDoConector)) return null;
  const conector = conectores.find((item) => item.chave === pedido.reserva);
  return conector ? { tipo: "seguir", reserva: pedido.reserva, conector } : { tipo: "repassar", reserva: pedido.reserva };
}

/**
 * O PJe ou o DCP disseram que o processo migrou para o eproc e este robô não atende o eproc do tribunal: o conector
 * ("eproc:TJRJ") a quem o pedido volta na fila. Nulo para qualquer outro erro.
 */
export function repasseDoMigrado(erro: unknown): string | null {
  return erro instanceof MigradoParaEproc ? erro.reserva : null;
}
