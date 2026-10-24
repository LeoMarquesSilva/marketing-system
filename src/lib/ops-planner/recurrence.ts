/**
 * Motor das rotinas recorrentes do Planner de Operações Legais (puro).
 *
 * Datas são strings AAAA-MM-DD; dia útil vem de fora (criarCalendario com os
 * feriados do SIOE, em src/lib/vistagem/dias-uteis.ts), para os testes não
 * dependerem do banco.
 */

import { addDays, diffDays } from "./domain";
import type { OpsRecurrenceRule } from "./types";

export type EhDiaUtil = (iso: string) => boolean;

export const WEEKDAY_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const WEEKDAY_PLURAL = ["domingos", "segundas", "terças", "quartas", "quintas", "sextas", "sábados"];
export const WEEKDAY_SINGULAR = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
export const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

function maxDate(...dates: Array<string | null | undefined>): string {
  return dates.filter((date): date is string => Boolean(date)).sort().at(-1) as string;
}

/** Fim de semana ou feriado: mantém, volta para o dia útil anterior ou vai para o próximo. */
function shiftToBusinessDay(date: string, mode: OpsRecurrenceRule["shift_non_business"], ehDiaUtil: EhDiaUtil): string {
  if (mode === "manter" || ehDiaUtil(date)) return date;
  const step = mode === "adiar" ? 1 : -1;
  let current = date;
  for (let i = 0; i < 31 && !ehDiaUtil(current); i += 1) current = addDays(current, step);
  return current;
}

/** Data do mês pela regra mensal/anual (antes do ajuste de fim de semana). */
function dateInMonth(rule: OpsRecurrenceRule, year: number, month: number, ehDiaUtil: EhDiaUtil): string | null {
  const lastDay = daysInMonth(year, month);
  switch (rule.monthly_mode) {
    case "dia_do_mes": {
      const wanted = rule.month_day ?? 1;
      // Dia 31 em mês de 30 (ou 29/02 fora do bissexto) cai no último dia do mês.
      const day = wanted === -1 ? lastDay : Math.min(wanted, lastDay);
      return iso(year, month, day);
    }
    case "dia_util": {
      const n = rule.business_day_n ?? 1;
      if (n === -1) {
        for (let day = lastDay; day >= 1; day -= 1) {
          if (ehDiaUtil(iso(year, month, day))) return iso(year, month, day);
        }
        return null;
      }
      let count = 0;
      let lastBusiness: string | null = null;
      for (let day = 1; day <= lastDay; day += 1) {
        const date = iso(year, month, day);
        if (!ehDiaUtil(date)) continue;
        count += 1;
        lastBusiness = date;
        if (count === n) return date;
      }
      // Mês com menos dias úteis do que o pedido: fica no último dia útil.
      return lastBusiness;
    }
    case "semana_do_mes": {
      const weekday = rule.weekday ?? 1;
      const week = rule.week_of_month ?? 1;
      if (week === -1) {
        for (let day = lastDay; day >= 1; day -= 1) {
          if (weekdayOf(iso(year, month, day)) === weekday) return iso(year, month, day);
        }
        return null;
      }
      const firstWeekday = weekdayOf(iso(year, month, 1));
      const day = 1 + ((weekday - firstWeekday + 7) % 7) + (week - 1) * 7;
      return day <= lastDay ? iso(year, month, day) : null;
    }
    default:
      return null;
  }
}

/** Datas de vencimento da regra entre `from` e `to` (inclusive), em ordem. */
export function occurrencesBetween(rule: OpsRecurrenceRule, from: string, to: string, ehDiaUtil: EhDiaUtil): string[] {
  const start = maxDate(from, rule.starts_on);
  const end = rule.ends_on && rule.ends_on < to ? rule.ends_on : to;
  if (start > end) return [];
  const every = Math.max(1, rule.every_n || 1);
  const found = new Set<string>();
  const keep = (date: string | null) => {
    if (date && date >= start && date <= end) found.add(date);
  };

  if (rule.frequency === "diaria") {
    // Conta a partir do início da rotina para "a cada N dias" não mudar com a janela.
    let index = 0;
    for (let day = rule.starts_on; day <= end; day = addDays(day, 1)) {
      if (rule.only_business_days && !ehDiaUtil(day)) continue;
      if (index % every === 0) keep(day);
      index += 1;
    }
    return [...found].sort();
  }

  // Margem de uma semana: o ajuste para dia útil pode trazer uma data de fora da janela.
  const scanFrom = addDays(start, -7);
  const scanTo = addDays(end, 7);

  if (rule.frequency === "semanal") {
    const weekdays = rule.weekdays.length > 0 ? rule.weekdays : [weekdayOf(rule.starts_on)];
    const anchorWeek = addDays(rule.starts_on, -weekdayOf(rule.starts_on));
    for (let day = scanFrom; day <= scanTo; day = addDays(day, 1)) {
      if (!weekdays.includes(weekdayOf(day))) continue;
      const weekIndex = Math.floor(diffDays(anchorWeek, day) / 7);
      if (weekIndex < 0 || weekIndex % every !== 0) continue;
      keep(shiftToBusinessDay(day, rule.shift_non_business, ehDiaUtil));
    }
    return [...found].sort();
  }

  const [anchorYear, anchorMonth] = rule.starts_on.split("-").map(Number);
  const [fromYear, fromMonth] = scanFrom.split("-").map(Number);
  const [toYear, toMonth] = scanTo.split("-").map(Number);

  if (rule.frequency === "mensal") {
    const lastIndex = toYear * 12 + toMonth;
    for (let index = fromYear * 12 + fromMonth; index <= lastIndex; index += 1) {
      const y = Math.floor((index - 1) / 12);
      const m = index - y * 12;
      const monthIndex = (y - anchorYear) * 12 + (m - anchorMonth);
      if (monthIndex < 0 || monthIndex % every !== 0) continue;
      const date = dateInMonth(rule, y, m, ehDiaUtil);
      if (date) keep(rule.monthly_mode === "dia_util" ? date : shiftToBusinessDay(date, rule.shift_non_business, ehDiaUtil));
    }
    return [...found].sort();
  }

  // anual
  const month = rule.month ?? anchorMonth;
  for (let y = fromYear; y <= toYear; y += 1) {
    const yearIndex = y - anchorYear;
    if (yearIndex < 0 || yearIndex % every !== 0) continue;
    const date = dateInMonth(rule, y, month, ehDiaUtil);
    if (date) keep(rule.monthly_mode === "dia_util" ? date : shiftToBusinessDay(date, rule.shift_non_business, ehDiaUtil));
  }
  return [...found].sort();
}

/** Próximas `count` datas a partir de `from` (inclusive). */
export function nextOccurrences(rule: OpsRecurrenceRule, from: string, count: number, ehDiaUtil: EhDiaUtil): string[] {
  const dates: string[] = [];
  let windowStart = from;
  // Até ~10 anos para frente cobre "a cada 2 anos" e rotinas que começam longe.
  for (let i = 0; i < 10 && dates.length < count; i += 1) {
    const windowEnd = addDays(windowStart, 365);
    dates.push(...occurrencesBetween(rule, windowStart, windowEnd, ehDiaUtil));
    if (rule.ends_on && windowEnd >= rule.ends_on) break;
    windowStart = addDays(windowEnd, 1);
  }
  return dates.slice(0, count);
}

/** Quantos dias para trás o cron recupera se ficou sem rodar. */
export const CATCH_UP_DAYS = 31;

export interface GenerationInput extends OpsRecurrenceRule {
  lead_days: number;
  last_occurrence_date: string | null;
  active: boolean;
}

/**
 * Ocorrências que já devem virar tarefa hoje: vencimento até hoje + lead_days.
 * Nunca volta para antes da criação da rotina, da última ocorrência gerada nem
 * de CATCH_UP_DAYS atrás.
 */
export function occurrencesToGenerate(
  routine: GenerationInput,
  today: string,
  createdOn: string,
  ehDiaUtil: EhDiaUtil
): string[] {
  if (!routine.active) return [];
  const lower = maxDate(
    routine.starts_on,
    createdOn,
    addDays(today, -CATCH_UP_DAYS),
    routine.last_occurrence_date ? addDays(routine.last_occurrence_date, 1) : null
  );
  const upper = addDays(today, Math.max(0, routine.lead_days));
  return occurrencesBetween(routine, lower, upper, ehDiaUtil);
}

function listWithAnd(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`;
}

function describeMonthPart(rule: OpsRecurrenceRule): string {
  switch (rule.monthly_mode) {
    case "dia_do_mes":
      return rule.month_day === -1 ? "no último dia" : `no dia ${rule.month_day ?? 1}`;
    case "dia_util":
      return rule.business_day_n === -1 ? "no último dia útil" : `no ${rule.business_day_n ?? 1}º dia útil`;
    case "semana_do_mes": {
      const weekday = WEEKDAY_SINGULAR[rule.weekday ?? 1];
      return rule.week_of_month === -1 ? `na última ${weekday}` : `na ${rule.week_of_month ?? 1}ª ${weekday}`;
    }
    default:
      return "";
  }
}

/** Frase da regra para a tela ("Todo mês no 5º dia útil"). */
export function describeRule(rule: OpsRecurrenceRule): string {
  const every = Math.max(1, rule.every_n || 1);
  switch (rule.frequency) {
    case "diaria":
      if (rule.only_business_days) return every === 1 ? "Todo dia útil" : `A cada ${every} dias úteis`;
      return every === 1 ? "Todo dia" : `A cada ${every} dias`;
    case "semanal": {
      const days = (rule.weekdays.length > 0 ? rule.weekdays : [weekdayOf(rule.starts_on)])
        .slice()
        .sort((a, b) => a - b)
        .map((day) => WEEKDAY_PLURAL[day]);
      const prefix = every === 1 ? "Toda semana" : `A cada ${every} semanas`;
      return `${prefix} às ${listWithAnd(days)}`;
    }
    case "mensal": {
      const prefix =
        every === 1 ? "Todo mês" : every === 3 ? "A cada trimestre" : every === 6 ? "A cada semestre" : `A cada ${every} meses`;
      return `${prefix} ${describeMonthPart(rule)}`;
    }
    case "anual": {
      const prefix = every === 1 ? "Todo ano" : `A cada ${every} anos`;
      return `${prefix} em ${MONTHS[(rule.month ?? 1) - 1]}, ${describeMonthPart(rule)}`;
    }
    default:
      return "";
  }
}

/** Erro de regra para mostrar no formulário; null quando a regra é válida. */
export function validateRule(rule: OpsRecurrenceRule): string | null {
  if (rule.frequency === "semanal" && rule.weekdays.some((day) => day < 0 || day > 6)) {
    return "Escolha dias da semana válidos.";
  }
  if (rule.frequency === "mensal" || rule.frequency === "anual") {
    if (!rule.monthly_mode) return "Escolha como a data cai no mês.";
    if (rule.monthly_mode === "dia_do_mes" && !rule.month_day) return "Informe o dia do mês.";
    if (rule.monthly_mode === "dia_util" && !rule.business_day_n) return "Informe qual dia útil.";
    if (rule.monthly_mode === "semana_do_mes" && (!rule.week_of_month || rule.weekday === null)) {
      return "Informe a semana e o dia da semana.";
    }
  }
  if (rule.frequency === "anual" && !rule.month) return "Informe o mês.";
  if (rule.ends_on && rule.ends_on < rule.starts_on) return "O fim precisa ser depois do início.";
  return null;
}
