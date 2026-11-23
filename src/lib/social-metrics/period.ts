/**
 * Período das telas de Métricas (Resumo, Instagram, LinkedIn e Site).
 *
 * Datas sempre em "AAAA-MM-DD" no fuso de São Paulo. Os atalhos de N dias
 * terminam ONTEM: os números da conta só fecham no dia seguinte (padrão do
 * Meta Business Suite, Metricool e Sprout). A comparação é com o período
 * anterior de mesmo tamanho ou com as mesmas datas do ano anterior.
 */

export type MetricsPreset = "7d" | "28d" | "90d" | "mes" | "mes-anterior" | "ano" | "personalizado";
export type MetricsCompare = "anterior" | "ano-anterior";

export interface MetricsPeriodState {
  preset: MetricsPreset;
  compare: MetricsCompare;
  /** Só no personalizado. */
  from?: string;
  to?: string;
}

export interface ResolvedMetricsPeriod {
  preset: MetricsPreset;
  compare: MetricsCompare;
  from: string;
  to: string;
  days: number;
  label: string;
  compareFrom: string;
  compareTo: string;
  compareLabel: string;
}

export const METRICS_PRESETS: { value: MetricsPreset; label: string }[] = [
  { value: "7d", label: "7 dias" },
  { value: "28d", label: "28 dias" },
  { value: "90d", label: "90 dias" },
  { value: "mes", label: "Este mês" },
  { value: "mes-anterior", label: "Mês passado" },
  { value: "ano", label: "Este ano" },
  { value: "personalizado", label: "Personalizado" },
];

export const METRICS_COMPARE_OPTIONS: { value: MetricsCompare; label: string }[] = [
  { value: "anterior", label: "vs período anterior" },
  { value: "ano-anterior", label: "vs ano anterior" },
];

export const DEFAULT_METRICS_PERIOD: MetricsPeriodState = { preset: "28d", compare: "anterior" };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Data de hoje (AAAA-MM-DD) em São Paulo. */
export function todayInSaoPaulo(now: Date = new Date()): string {
  return dateInSaoPaulo(now);
}

/** Data (AAAA-MM-DD) de um instante em São Paulo. */
export function dateInSaoPaulo(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function toUtc(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, amount: number): string {
  return fromUtc(toUtc(date) + amount * DAY_MS);
}

/** Dias entre as datas, contando as duas pontas. */
export function daysInclusive(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS) + 1;
}

export function eachDate(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let cursor = toUtc(from), end = toUtc(to); cursor <= end; cursor += DAY_MS) dates.push(fromUtc(cursor));
  return dates;
}

export function isDateInRange(date: string | null | undefined, from: string, to: string): boolean {
  return Boolean(date) && (date as string) >= from && (date as string) <= to;
}

function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

function monthEnd(date: string): string {
  const [y, m] = date.split("-").map(Number);
  return fromUtc(Date.UTC(y, m, 0));
}

/** Mesmo dia N meses antes, preso ao último dia do mês (31/03 − 1 mês = 28/02). */
function shiftMonths(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return fromUtc(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, lastDay)));
}

function shiftYears(date: string, years: number): string {
  return shiftMonths(date, years * 12);
}

export function formatDayMonth(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

export function formatFullDate(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
}

/** "01/11 – 22/11/2026", "nov/2026" (mês inteiro) ou "18/11/2026" (um dia). */
export function formatRange(from: string, to: string): string {
  if (from === to) return formatFullDate(from);
  if (from === monthStart(from) && to === monthEnd(from)) {
    return `${MONTHS[Number(from.slice(5, 7)) - 1]}/${from.slice(0, 4)}`;
  }
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${sameYear ? formatDayMonth(from) : formatFullDate(from)} – ${formatFullDate(to)}`;
}

export function resolveMetricsPeriod(state: MetricsPeriodState, now: Date = new Date()): ResolvedMetricsPeriod {
  const today = todayInSaoPaulo(now);
  const yesterday = addDays(today, -1);
  let from: string;
  let to: string;

  switch (state.preset) {
    case "7d":
    case "28d":
    case "90d": {
      const n = Number(state.preset.replace("d", ""));
      to = yesterday;
      from = addDays(to, -(n - 1));
      break;
    }
    case "mes":
      from = monthStart(today);
      to = yesterday < from ? today : yesterday;
      break;
    case "mes-anterior": {
      const lastMonth = shiftMonths(monthStart(today), -1);
      from = lastMonth;
      to = monthEnd(lastMonth);
      break;
    }
    case "ano":
      from = `${today.slice(0, 4)}-01-01`;
      to = yesterday < from ? today : yesterday;
      break;
    case "personalizado":
    default: {
      const a = state.from && ISO_DATE.test(state.from) ? state.from : addDays(yesterday, -27);
      const b = state.to && ISO_DATE.test(state.to) ? state.to : yesterday;
      [from, to] = a <= b ? [a, b] : [b, a];
      break;
    }
  }

  const days = daysInclusive(from, to);
  let compareFrom: string;
  let compareTo: string;
  if (state.compare === "ano-anterior") {
    compareFrom = shiftYears(from, -1);
    compareTo = shiftYears(to, -1);
  } else if (state.preset === "mes" || state.preset === "mes-anterior") {
    // Mês contra o mês anterior até o mesmo dia (1–22/11 contra 1–22/10).
    compareFrom = shiftMonths(from, -1);
    compareTo = state.preset === "mes-anterior" ? monthEnd(compareFrom) : shiftMonths(to, -1);
  } else {
    compareTo = addDays(from, -1);
    compareFrom = addDays(compareTo, -(days - 1));
  }

  const presetLabel = METRICS_PRESETS.find((p) => p.value === state.preset)?.label ?? "";
  return {
    preset: state.preset,
    compare: state.compare,
    from,
    to,
    days,
    label: state.preset === "personalizado" ? formatRange(from, to) : `${presetLabel} · ${formatRange(from, to)}`,
    compareFrom,
    compareTo,
    compareLabel: formatRange(compareFrom, compareTo),
  };
}

/** Lê o período da URL (?periodo=28d&comparar=anterior&de=...&ate=...). */
export function parseMetricsPeriod(params: URLSearchParams | Record<string, string | undefined>): MetricsPeriodState {
  const get = (key: string) =>
    params instanceof URLSearchParams ? params.get(key) ?? undefined : params[key];
  const preset = get("periodo") as MetricsPreset | undefined;
  const compare = get("comparar") as MetricsCompare | undefined;
  const valid = METRICS_PRESETS.some((p) => p.value === preset);
  return {
    preset: valid ? (preset as MetricsPreset) : DEFAULT_METRICS_PERIOD.preset,
    compare: compare === "ano-anterior" ? "ano-anterior" : "anterior",
    from: get("de"),
    to: get("ate"),
  };
}

export function serializeMetricsPeriod(state: MetricsPeriodState): Record<string, string> {
  const out: Record<string, string> = { periodo: state.preset, comparar: state.compare };
  if (state.preset === "personalizado") {
    if (state.from) out.de = state.from;
    if (state.to) out.ate = state.to;
  }
  return out;
}
