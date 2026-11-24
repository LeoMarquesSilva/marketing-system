/** Regras puras das 1:1 (testadas em rules.test.ts). */

import type { OneOnOneCadence, OneOnOneDisplayStatus, OneOnOneFrequency, OneOnOneStatus } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
export const SAO_PAULO = "America/Sao_Paulo";

export function displayStatus(status: OneOnOneStatus, endsAt: string, now: Date = new Date()): OneOnOneDisplayStatus {
  if (status === "agendada" && new Date(endsAt).getTime() < now.getTime()) return "atrasada";
  return status;
}

/** Dias inteiros entre duas datas/instantes (a partir do dia de `from`). */
export function daysSince(fromIso: string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(fromIso).getTime()) / DAY_MS));
}

/** Em dia = última 1:1 realizada há até `overdueDays` dias (ou uma marcada dentro do prazo). */
export function cadenceOf(
  lastDoneAt: string | null,
  nextAt: string | null,
  overdueDays: number,
  now: Date = new Date()
): OneOnOneCadence {
  if (!lastDoneAt && !nextAt) return "sem_reuniao";
  if (lastDoneAt && daysSince(lastDoneAt, now) <= overdueDays) return "em_dia";
  if (!lastDoneAt && nextAt) return "em_dia";
  return "atrasada";
}

/**
 * Offset de São Paulo (em minutos) para um instante. O Brasil não tem horário de verão desde 2019,
 * mas o cálculo pelo Intl continua certo se isso mudar.
 */
function saoPauloOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SAO_PAULO,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** "2026-11-20T14:00" (hora de São Paulo) → instante ISO em UTC. */
export function localToIso(local: string): string {
  const [date, time = "00:00"] = local.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const offset = saoPauloOffsetMinutes(new Date(guess));
  return new Date(guess - offset * 60000).toISOString();
}

/** Instante ISO → "2026-11-20T14:00" na hora de São Paulo. */
export function isoToLocal(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SAO_PAULO,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function addDaysIso(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** n-ésimo dia da semana do mês (1ª quarta, 3ª segunda…); 5ª que não existe vira a última. */
function nthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number): string {
  const first = new Date(Date.UTC(year, month, 1));
  const shift = (weekday - first.getUTCDay() + 7) % 7;
  let day = 1 + shift + (nth - 1) * 7;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  while (day > lastDay) day -= 7;
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

/**
 * Datas da recorrência a partir da primeira (inclusive) até `until` (inclusive), no máximo 52.
 * Mensal = mesmo dia da semana e mesma posição no mês ("toda 2ª terça"), como no Feedz.
 */
export function recurrenceDates(firstDate: string, frequency: OneOnOneFrequency, until: string, max = 52): string[] {
  const dates: string[] = [];
  if (until < firstDate) return dates;
  if (frequency === "mensal") {
    const [y, m, d] = firstDate.split("-").map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const nth = Math.ceil(d / 7);
    for (let i = 0; i < max; i += 1) {
      const date = nthWeekdayOfMonth(y + Math.floor((m - 1 + i) / 12), (m - 1 + i) % 12, weekday, nth);
      if (date > until) break;
      dates.push(date);
    }
    return dates;
  }
  const step = frequency === "semanal" ? 7 : 14;
  for (let date = firstDate; date <= until && dates.length < max; date = addDaysIso(date, step)) dates.push(date);
  return dates;
}

/**
 * Livre/ocupado do Graph (`availabilityView`): um caractere por intervalo; "0" = livre,
 * "1" provisório, "2" ocupado, "3" fora do escritório, "4" trabalhando em outro lugar.
 * O horário serve se todos estão livres (0 ou 4) em todos os intervalos que a reunião cobre.
 */
export function isWindowFree(view: string, startIndex: number, slots: number): boolean {
  if (!view) return true;
  for (let i = startIndex; i < startIndex + slots; i += 1) {
    const char = view[i];
    if (char === undefined) return true;
    if (char !== "0" && char !== "4") return false;
  }
  return true;
}

/** Inícios possíveis do dia (8h às 19h), de 30 em 30 minutos, com quem está ocupado em cada um. */
export function dayGrid(
  views: Array<{ label: string; view: string }>,
  durationMinutes: number,
  interval = 30,
  dayStartHour = 8,
  dayEndHour = 19
): Array<{ time: string; free: boolean; busy: string[] }> {
  const slotsNeeded = Math.max(1, Math.ceil(durationMinutes / interval));
  const grid: Array<{ time: string; free: boolean; busy: string[] }> = [];
  const totalSlots = ((dayEndHour - dayStartHour) * 60) / interval;
  for (let index = 0; index + slotsNeeded <= totalSlots; index += 1) {
    const minutes = dayStartHour * 60 + index * interval;
    const time = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    const busy = views.filter((item) => !isWindowFree(item.view, index, slotsNeeded)).map((item) => item.label);
    grid.push({ time, free: busy.length === 0, busy });
  }
  return grid;
}

/** Média das notas (1 a 5) com uma casa; sem nota = null. */
export function ratingAverage(ratings: Array<number | null>): number | null {
  const values = ratings.filter((value): value is number => typeof value === "number");
  return values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null;
}
