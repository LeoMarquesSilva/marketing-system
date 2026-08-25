import { buildCafeWindow, lastFridayOfMonth } from "./dates";
import type { CafeExpectationStatus } from "./types";

const MONTHS_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

export interface CafeEditionDraft {
  year: number;
  name: string;
  monthLabel: string;
  eventDate: string;
  checkinOpensAt: string;
  checkinClosesAt: string;
}
export interface CafeParticipantSummaryInput {
  expectationStatus: CafeExpectationStatus;
  checkinAt: string | null;
}

export interface CafeParticipantSummary {
  total: number;
  expected: number;
  excused: number;
  excluded: number;
  present: number;
  pending: number;
}

export function buildCafeEditionDraft(year: number, monthIndex: number): CafeEditionDraft {
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    throw new Error("Mês da edição inválido.");
  }
  const monthLabel = MONTHS_PT[monthIndex];
  const eventDate = lastFridayOfMonth(year, monthIndex);
  const window = buildCafeWindow(eventDate);
  return {
    year,
    name: `Café com Cultura — ${monthLabel} ${year}`,
    monthLabel,
    eventDate,
    checkinOpensAt: window.opensAt,
    checkinClosesAt: window.closesAt,
  };
}

export function summarizeCafeParticipants(
  participants: CafeParticipantSummaryInput[]
): CafeParticipantSummary {
  const expected = participants.filter((item) => item.expectationStatus === "confirmed").length;
  const excused = participants.filter((item) => item.expectationStatus === "excused_absence").length;
  const excluded = participants.filter((item) => item.expectationStatus === "excluded").length;
  const present = participants.filter((item) => Boolean(item.checkinAt)).length;
  const pending = participants.filter(
    (item) => item.expectationStatus === "confirmed" && !item.checkinAt
  ).length;
  return { total: participants.length, expected, excused, excluded, present, pending };
}
