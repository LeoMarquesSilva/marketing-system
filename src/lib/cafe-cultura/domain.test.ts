import { describe, expect, it } from "vitest";
import { buildCafeEditionDraft, summarizeCafeParticipants } from "./domain";

describe("buildCafeEditionDraft", () => {
  it("cria a edição de agosto na última sexta com janela padrão", () => {
    expect(buildCafeEditionDraft(2026, 7)).toMatchObject({
      year: 2026,
      name: "Café com Cultura — Agosto 2026",
      monthLabel: "Agosto",
      eventDate: "2026-08-28",
      checkinOpensAt: "2026-08-28T12:00:00.000Z",
      checkinClosesAt: "2026-08-28T15:00:00.000Z",
    });
  });
});

describe("summarizeCafeParticipants", () => {
  it("separa quantidade do local, justificativas, presenças e pendências", () => {
    expect(
      summarizeCafeParticipants([
        { expectationStatus: "confirmed", checkinAt: "2026-08-28T12:10:00Z" },
        { expectationStatus: "confirmed", checkinAt: null },
        { expectationStatus: "excused_absence", checkinAt: null },
        { expectationStatus: "excused_absence", checkinAt: "2026-08-28T12:20:00Z" },
        { expectationStatus: "excluded", checkinAt: null },
      ])
    ).toEqual({
      total: 5,
      expected: 2,
      excused: 2,
      excluded: 1,
      present: 2,
      pending: 1,
    });
  });
});
