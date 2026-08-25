import type { CafeWindow, CafeWindowState } from "./types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_IN_TEXT = /\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2}|\d{4}))?\b/g;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
function isCalendarDate(year: number, month: number, day: number): boolean {
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

export function lastFridayOfMonth(year: number, monthIndex: number): string {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0));
  const daysSinceFriday = (lastDay.getUTCDay() - 5 + 7) % 7;
  lastDay.setUTCDate(lastDay.getUTCDate() - daysSinceFriday);
  return `${lastDay.getUTCFullYear()}-${pad(lastDay.getUTCMonth() + 1)}-${pad(lastDay.getUTCDate())}`;
}

export function buildCafeWindow(eventDate: string): CafeWindow {
  if (!ISO_DATE.test(eventDate)) throw new Error("Data do evento inválida.");
  const opens = new Date(`${eventDate}T09:00:00-03:00`);
  const closes = new Date(`${eventDate}T12:00:00-03:00`);
  if (Number.isNaN(opens.getTime()) || Number.isNaN(closes.getTime())) {
    throw new Error("Data do evento inválida.");
  }
  return { opensAt: opens.toISOString(), closesAt: closes.toISOString() };
}

export function getCheckinWindowState(
  now: string | Date,
  opensAt: string,
  closesAt: string
): CafeWindowState {
  const current = new Date(now).getTime();
  const opens = new Date(opensAt).getTime();
  const closes = new Date(closesAt).getTime();
  if (![current, opens, closes].every(Number.isFinite) || closes <= opens) {
    throw new Error("Janela de check-in inválida.");
  }
  if (current < opens) return "before";
  if (current >= closes) return "closed";
  return "open";
}

export function extractCafeEventDate(text: string, referenceYear: number): string | null {
  for (const match of text.matchAll(DATE_IN_TEXT)) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const rawYear = match[3];
    const year = rawYear ? (rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear)) : referenceYear;
    if (!isCalendarDate(year, month, day)) continue;
    return `${year}-${pad(month)}-${pad(day)}`;
  }
  return null;
}
