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

/**
 * Cadeia do prazo antes da fatal: Enviar D-3, Revisar D-2 e Protocolar D-1 (dias úteis).
 * O VIOS recebe o Enviar; o fluxo automático dele cria o Revisar e o Protocolar (+1 útil cada).
 */
export function datasDoPrazo(fatal: string, ehDiaUtil: (iso: string) => boolean) {
  return {
    fatal,
    protocolar: somarDiasUteis(fatal, -1, ehDiaUtil),
    revisar: somarDiasUteis(fatal, -2, ehDiaUtil),
    enviar: somarDiasUteis(fatal, -3, ehDiaUtil),
  };
}
