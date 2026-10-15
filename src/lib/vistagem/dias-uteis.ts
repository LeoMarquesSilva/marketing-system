import { CADEIA_PADRAO, type CadeiaDoPrazo } from "./fluxo-vios";

/** Atalhos de prazo (dias úteis contados a partir do 1º dia útil após a publicação). */
export const DIAS_PRAZO = [5, 10, 15, 30, 60, 90, 180] as const;

/** Dia útil: não é sábado, domingo nem feriado (lista AAAA-MM-DD). */
export function criarCalendario(feriados: Iterable<string>): (iso: string) => boolean {
  const conjunto = new Set(feriados);
  return (iso) => {
    const dia = new Date(`${iso}T12:00:00Z`).getUTCDay();
    return dia !== 0 && dia !== 6 && !conjunto.has(iso);
  };
}

function deslocar(iso: string, dias: number): string {
  const data = new Date(`${iso}T12:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

/** Anda n dias úteis para frente (n > 0) ou para trás (n < 0), sem contar o dia de partida. */
export function somarDiasUteis(iso: string, n: number, ehDiaUtil: (iso: string) => boolean): string {
  const passo = n >= 0 ? 1 : -1;
  let atual = iso;
  let restantes = Math.abs(n);
  while (restantes > 0) {
    atual = deslocar(atual, passo);
    if (ehDiaUtil(atual)) restantes -= 1;
  }
  return atual;
}

/** Data fatal: N dias úteis contados a partir do 1º dia útil após a publicação. */
export function fatalPorDias(dataPublicacao: string, dias: number, ehDiaUtil: (iso: string) => boolean): string {
  return somarDiasUteis(dataPublicacao, dias, ehDiaUtil);
}

export interface DatasDoPrazo {
  fatal: string;
  /** Data da tarefa que vai para o VIOS. */
  enviar: string;
  /** Null quando o fluxo do VIOS não cria a tarefa. */
  revisar: string | null;
  protocolar: string | null;
}

/**
 * Datas do prazo antes da fatal. O VIOS recebe a data da tarefa (Enviar) e o fluxo
 * automático cria o Revisar e o Protocolar a N dias úteis dela; o Protocolar tem de
 * cair 1 dia útil antes da fatal, então Enviar = fatal − 1 − N do Protocolar
 * (fluxo padrão: Enviar D-3, Revisar D-2, Protocolar D-1; fluxo D-5: Enviar D-5).
 * Sem Protocolar no fluxo, a tarefa vai com a data do protocolo (fatal − 1).
 */
export function datasDoPrazo(
  fatal: string,
  ehDiaUtil: (iso: string) => boolean,
  cadeia: CadeiaDoPrazo | null = CADEIA_PADRAO
): DatasDoPrazo {
  if (!cadeia) return { fatal, enviar: somarDiasUteis(fatal, -1, ehDiaUtil), revisar: null, protocolar: null };
  const enviar = somarDiasUteis(fatal, -(1 + cadeia.protocolar), ehDiaUtil);
  return {
    fatal,
    enviar,
    revisar: cadeia.revisar === null ? null : somarDiasUteis(enviar, cadeia.revisar, ehDiaUtil),
    protocolar: somarDiasUteis(enviar, cadeia.protocolar, ehDiaUtil),
  };
}
