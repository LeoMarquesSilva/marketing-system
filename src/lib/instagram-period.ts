import type { InstagramPost } from "./instagram-posts";

export type PeriodPreset =
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "last_quarter"
  | "this_year"
  | "last_year";

export type PeriodFilter =
  | { kind: "all" }
  | { kind: "preset"; preset: PeriodPreset }
  | { kind: "month"; year: number; month: number } // month: 0-11
  | { kind: "year"; year: number }
  | { kind: "range"; from: string; to: string }; // YYYY-MM-DD, inclusivo

export interface DateRange {
  from: Date;
  to: Date; // exclusivo
}

export const PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "this_month", label: "Este mês" },
  { value: "last_month", label: "Mês passado" },
  { value: "this_quarter", label: "Este trimestre" },
  { value: "last_quarter", label: "Trimestre passado" },
  { value: "this_year", label: "Este ano" },
  { value: "last_year", label: "Ano passado" },
];

const MONTH_NAMES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export const MONTH_SHORT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function presetRange(preset: PeriodPreset, now: Date): DateRange {
  const y = now.getFullYear();
  const m = now.getMonth();
  const q = Math.floor(m / 3);
  switch (preset) {
    case "this_month":
      return { from: new Date(y, m, 1), to: new Date(y, m + 1, 1) };
    case "last_month":
      return { from: new Date(y, m - 1, 1), to: new Date(y, m, 1) };
    case "this_quarter":
      return { from: new Date(y, q * 3, 1), to: new Date(y, q * 3 + 3, 1) };
    case "last_quarter":
      return { from: new Date(y, q * 3 - 3, 1), to: new Date(y, q * 3, 1) };
    case "this_year":
      return { from: new Date(y, 0, 1), to: new Date(y + 1, 0, 1) };
    case "last_year":
      return { from: new Date(y - 1, 0, 1), to: new Date(y, 0, 1) };
  }
}

/** Resolve o filtro para um intervalo de datas concreto. Retorna null para "tudo". */
export function resolvePeriodRange(
  filter: PeriodFilter,
  now = new Date()
): DateRange | null {
  switch (filter.kind) {
    case "all":
      return null;
    case "preset":
      return presetRange(filter.preset, now);
    case "month":
      return {
        from: new Date(filter.year, filter.month, 1),
        to: new Date(filter.year, filter.month + 1, 1),
      };
    case "year":
      return {
        from: new Date(filter.year, 0, 1),
        to: new Date(filter.year + 1, 0, 1),
      };
    case "range": {
      const from = new Date(`${filter.from}T00:00:00`);
      const toInclusive = new Date(`${filter.to}T00:00:00`);
      // torna o "to" exclusivo somando 1 dia
      const to = new Date(toInclusive);
      to.setDate(to.getDate() + 1);
      return { from, to };
    }
  }
}

export function isWithinRange(iso: string | null, range: DateRange | null): boolean {
  if (!range) return true;
  if (!iso) return false;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  return date >= range.from && date < range.to;
}

export function filterByPeriod<T extends { published_at: string | null }>(
  items: T[],
  range: DateRange | null
): T[] {
  if (!range) return items;
  return items.filter((item) => isWithinRange(item.published_at, range));
}

function formatDateBR(d: Date): string {
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Rótulo curto para o botão do seletor. */
export function formatPeriodFilterLabel(filter: PeriodFilter): string {
  switch (filter.kind) {
    case "all":
      return "Todo o período";
    case "preset":
      return PERIOD_PRESETS.find((p) => p.value === filter.preset)?.label ?? "Período";
    case "month":
      return `${MONTH_NAMES[filter.month]} de ${filter.year}`;
    case "year":
      return `Ano de ${filter.year}`;
    case "range": {
      const from = new Date(`${filter.from}T00:00:00`);
      const to = new Date(`${filter.to}T00:00:00`);
      return `${formatDateBR(from)} – ${formatDateBR(to)}`;
    }
  }
}

/** Descrição mais longa para subtítulos. */
export function describePeriodFilter(filter: PeriodFilter): string {
  if (filter.kind === "all") return "Todos os posts desde 2025";
  return formatPeriodFilterLabel(filter);
}

/** Janela imediatamente anterior, de mesma duração. */
export function getPreviousRange(range: DateRange): DateRange {
  const dur = range.to.getTime() - range.from.getTime();
  return { from: new Date(range.from.getTime() - dur), to: new Date(range.from) };
}

/** Rótulo amigável (minúsculo) de um intervalo: "maio de 2025", "2º trimestre de 2025", "ano de 2025" ou intervalo de datas. */
export function formatRangeLabel(range: DateRange): string {
  const { from, to } = range;
  if (from.getDate() === 1 && to.getDate() === 1) {
    const monthsDiff =
      (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
    if (monthsDiff === 1) {
      return `${MONTH_NAMES[from.getMonth()]} de ${from.getFullYear()}`;
    }
    if (monthsDiff === 3 && from.getMonth() % 3 === 0) {
      return `${Math.floor(from.getMonth() / 3) + 1}º trimestre de ${from.getFullYear()}`;
    }
    if (monthsDiff === 12 && from.getMonth() === 0) {
      return `ano de ${from.getFullYear()}`;
    }
  }
  const toInclusive = new Date(to.getTime() - 24 * 60 * 60 * 1000);
  return `${formatDateBR(from)} – ${formatDateBR(toInclusive)}`;
}

/** Rótulo do período de base (anterior) usado no comparativo, em minúsculo. */
export function describeComparisonBaseline(
  filter: PeriodFilter,
  now = new Date()
): string {
  const range = resolvePeriodRange(filter, now);
  if (!range) return "30 dias anteriores";
  return formatRangeLabel(getPreviousRange(range));
}

/** Anos disponíveis a partir das datas de publicação dos posts (desc). */
export function getAvailableYears(posts: InstagramPost[]): number[] {
  const years = new Set<number>();
  for (const post of posts) {
    if (!post.published_at) continue;
    const d = new Date(post.published_at);
    if (!Number.isNaN(d.getTime())) years.add(d.getFullYear());
  }
  const current = new Date().getFullYear();
  years.add(current);
  return Array.from(years).sort((a, b) => b - a);
}
