/**
 * Facilities > Limpeza: regras do cronograma (sem banco, testáveis).
 *
 * O cronograma tem 4 semanas x seg a sex, com um tipo de limpeza por ambiente
 * e dia (a planilha "Checklist limpeza V2"). Qual semana vale num dia: conta-se
 * pelas semanas do mês que têm dia útil (sem sábado, domingo e feriado); a
 * semana do 1º dia útil é a 1ª. A 5ª semana repete a 1ª (decisão de 25/11/2026).
 */

export const CLEANING_KINDS = ["simples", "media", "completa", "lavagem"] as const;
export type CleaningKind = (typeof CLEANING_KINDS)[number];

export const CLEANING_KIND_INFO: Record<CleaningKind, { label: string; letter: string }> = {
  simples: { label: "Simples", letter: "S" },
  media: { label: "Média", letter: "M" },
  completa: { label: "Completa", letter: "C" },
  lavagem: { label: "Lavagem", letter: "L" },
};

export const NOT_DONE_REASONS = ["ocupada", "reuniao", "falta_material", "outro"] as const;
export type NotDoneReason = (typeof NOT_DONE_REASONS)[number];
export const NOT_DONE_REASON_LABEL: Record<NotDoneReason, string> = {
  ocupada: "Sala ocupada",
  reuniao: "Em reunião",
  falta_material: "Falta de material",
  outro: "Outro motivo",
};

export const WEEKDAY_SHORT = ["", "Seg", "Ter", "Qua", "Qui", "Sex"] as const;
export const WEEKDAY_LONG = ["", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira"] as const;

/** Data de hoje em Brasília (o servidor roda em UTC). */
export function todayInSaoPaulo(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function toDate(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDaysIso(iso: string, days: number): string {
  const date = toDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

/** 1 = segunda ... 7 = domingo. */
export function isoWeekday(iso: string): number {
  const day = toDate(iso).getUTCDay();
  return day === 0 ? 7 : day;
}

export function mondayOf(iso: string): string {
  return addDaysIso(iso, 1 - isoWeekday(iso));
}

export function isBusinessDay(iso: string, holidays: ReadonlySet<string>): boolean {
  return isoWeekday(iso) <= 5 && !holidays.has(iso);
}

export interface CalendarDay {
  iso: string;
  weekday: number; // 1..5
  inMonth: boolean;
  holiday: boolean;
  business: boolean;
}

export interface CalendarWeek {
  monday: string;
  /** Posição no mês (1ª, 2ª...), contando só semanas com dia útil do mês. */
  weekOfMonth: number;
  /** Semana do cronograma (1 a 4) que vale nesses dias. */
  scheduleWeek: number;
  days: CalendarDay[];
}

/** Semana do cronograma para a n-ésima semana do mês: a 5ª repete a 1ª. */
export function scheduleWeekFor(weekOfMonth: number): number {
  return ((weekOfMonth - 1) % 4) + 1;
}

/** Semanas de seg a sex do mês ("AAAA-MM"), só as que têm dia útil dentro do mês. */
export function monthWeeks(month: string, holidays: ReadonlySet<string>): CalendarWeek[] {
  const first = `${month}-01`;
  const weeks: CalendarWeek[] = [];
  let monday = mondayOf(first);
  while (monday.slice(0, 7) <= month) {
    const days: CalendarDay[] = Array.from({ length: 5 }, (_, i) => {
      const iso = addDaysIso(monday, i);
      const inMonth = iso.slice(0, 7) === month;
      const holiday = holidays.has(iso);
      return { iso, weekday: i + 1, inMonth, holiday, business: inMonth && !holiday };
    });
    if (days.some((d) => d.business)) {
      const weekOfMonth = weeks.length + 1;
      weeks.push({ monday, weekOfMonth, scheduleWeek: scheduleWeekFor(weekOfMonth), days });
    }
    monday = addDaysIso(monday, 7);
  }
  return weeks;
}

/** Semana do cronograma e dia da semana de uma data; null em fim de semana ou feriado. */
export function scheduleSlot(iso: string, holidays: ReadonlySet<string>): { week: number; weekday: number; weekOfMonth: number } | null {
  if (!isBusinessDay(iso, holidays)) return null;
  const week = monthWeeks(iso.slice(0, 7), holidays).find((w) => w.days.some((d) => d.iso === iso));
  if (!week) return null;
  return { week: week.scheduleWeek, weekday: isoWeekday(iso), weekOfMonth: week.weekOfMonth };
}

/* ------------------------------------------------------------------ números */

export interface CleaningCheckLite {
  day: string;
  area_id: string;
  status: "limpo" | "nao_limpo";
  checked_at: string;
}

export interface DayStats {
  expected: number;
  done: number;
  notDone: number;
  pending: number;
}

export function dayStats(expectedAreaIds: string[], checks: CleaningCheckLite[]): DayStats {
  const byArea = new Map(checks.map((c) => [c.area_id, c.status]));
  let done = 0;
  let notDone = 0;
  for (const id of expectedAreaIds) {
    const status = byArea.get(id);
    if (status === "limpo") done++;
    else if (status === "nao_limpo") notDone++;
  }
  return { expected: expectedAreaIds.length, done, notDone, pending: expectedAreaIds.length - done - notDone };
}

export function percent(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/** "08:42" no fuso de Brasília. */
export function timeInSaoPaulo(isoTimestamp: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(isoTimestamp));
}

/** "25/11" */
export function shortDay(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "novembro de 2026" */
export function monthLabel(month: string): string {
  return `${MONTHS[Number(month.slice(5, 7)) - 1]} de ${month.slice(0, 4)}`;
}

export function addMonthsKey(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}
