import { CADEIA_PADRAO, type CadeiaDoPrazo } from "./fluxo-vios";

/** Atalhos de prazo (dias contados a partir do 1º dia útil após a publicação). */
export const DIAS_PRAZO = [5, 10, 15, 30, 60, 90, 180] as const;

/** Como o prazo é contado: dias úteis (CPC art. 219) ou corridos (ex.: Lei 11.101, art. 189). */
export type ContagemPrazo = "uteis" | "corridos";

export const CONTAGENS_PRAZO: readonly ContagemPrazo[] = ["uteis", "corridos"];

export const ROTULO_CONTAGEM: Record<ContagemPrazo, string> = { uteis: "dias úteis", corridos: "dias corridos" };

/** Dia útil: não é sábado, domingo nem feriado (lista AAAA-MM-DD). */
export function criarCalendario(feriados: Iterable<string>): (iso: string) => boolean {
  const conjunto = new Set(feriados);
  return (iso) => {
    const dia = new Date(`${iso}T12:00:00Z`).getUTCDay();
    return dia !== 0 && dia !== 6 && !conjunto.has(iso);
  };
}

/** Recesso forense: de 20/12 a 20/01 os prazos ficam suspensos (CPC art. 220; CLT art. 775-A). */
export function noRecessoForense(iso: string): boolean {
  const mesDia = iso.slice(5, 10);
  return mesDia >= "12-20" || mesDia <= "01-20";
}

/**
 * Calendário para contar a data fatal: dia útil e fora do recesso forense.
 * As tarefas internas (Enviar, Revisar, Protocolar) seguem só o expediente (criarCalendario).
 */
export function criarCalendarioDePrazo(feriados: Iterable<string>): (iso: string) => boolean {
  const util = criarCalendario(feriados);
  return (iso) => util(iso) && !noRecessoForense(iso);
}

function deslocar(iso: string, dias: number): string {
  const data = new Date(`${iso}T12:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher), AAAA-MM-DD. */
export function pascoa(ano: number): string {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * Feriados em que o Judiciário fecha no país todo, no mesmo padrão da base do SIOE
 * (nacionais + Carnaval, Sexta-feira Santa e Corpus Christi). Usado para os anos que
 * a base ainda não tem.
 */
export function feriadosNacionais(ano: number): string[] {
  const p = pascoa(ano);
  const fixos = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"].map((md) => `${ano}-${md}`);
  return [...fixos, deslocar(p, -48), deslocar(p, -47), deslocar(p, -2), deslocar(p, 60)].sort();
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

/** Data fatal: N dias úteis contados a partir do 1º dia útil após a publicação (use criarCalendarioDePrazo). */
export function fatalPorDias(dataPublicacao: string, dias: number, ehDiaUtil: (iso: string) => boolean): string {
  return somarDiasUteis(dataPublicacao, dias, ehDiaUtil);
}

/**
 * Data fatal em dias corridos: a contagem começa no 1º dia útil após a publicação
 * (CPC art. 224 §3º), conta todos os dias seguintes menos os do recesso forense, que
 * suspende o prazo, e um vencimento em dia sem expediente passa para o próximo dia útil
 * (CPC art. 224 §1º). Use criarCalendarioDePrazo.
 */
export function fatalPorDiasCorridos(dataPublicacao: string, dias: number, ehDiaDePrazo: (iso: string) => boolean): string {
  let atual = somarDiasUteis(dataPublicacao, 1, ehDiaDePrazo);
  for (let restantes = dias - 1; restantes > 0; ) {
    atual = deslocar(atual, 1);
    if (!noRecessoForense(atual)) restantes -= 1;
  }
  return ehDiaDePrazo(atual) ? atual : somarDiasUteis(atual, 1, ehDiaDePrazo);
}

/** Data fatal pelo atalho de dias, na contagem escolhida. */
export function fatalPorContagem(
  dataPublicacao: string,
  dias: number,
  contagem: ContagemPrazo,
  ehDiaDePrazo: (iso: string) => boolean
): string {
  return contagem === "corridos" ? fatalPorDiasCorridos(dataPublicacao, dias, ehDiaDePrazo) : fatalPorDias(dataPublicacao, dias, ehDiaDePrazo);
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
