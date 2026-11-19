import "server-only";

import { criarCalendario, feriadosNacionais } from "@/lib/vistagem/dias-uteis";
import { carregarFeriados } from "@/lib/vistagem/feriados";

/**
 * Dia útil do Planner: fim de semana e feriados da base do SIOE (os mesmos da
 * Vistagem). Sem o SIOE, cai nos feriados nacionais calculados.
 */
export async function loadEhDiaUtil(): Promise<(iso: string) => boolean> {
  try {
    return criarCalendario(await carregarFeriados());
  } catch (error) {
    console.warn("[ops-planner] feriados do SIOE indisponíveis; usando os nacionais", error);
    const year = new Date().getUTCFullYear();
    return criarCalendario([year - 1, year, year + 1, year + 2].flatMap(feriadosNacionais));
  }
}
