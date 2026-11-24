import { FalhaDoConector } from "./conectores/tipos.ts";
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
