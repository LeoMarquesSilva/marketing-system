import { describe, expect, it } from "vitest";
import { buildCafeAttendanceCsv } from "./csv";

describe("buildCafeAttendanceCsv", () => {
  it("gera CSV com BOM, separador compatível com Excel e escaping", () => {
    const csv = buildCafeAttendanceCsv([
      {
        id: "p1",
        userId: "u1",
        name: 'Ana "Nina" Souza',
        email: "ana@bp.com",
        department: "Societário; Contratos",
        avatarUrl: null,
        expectationStatus: "confirmed",
        expectationSource: "automatic_roster",
        checkinAt: "2026-08-28T12:10:00.000Z",
        checkinSource: "nfc",
        responsumTicketCount: 0,
      },
    ]);
    expect(csv.startsWith("\uFEFFNome;E-mail;Área;Situação;Presença;Horário")).toBe(true);
    expect(csv).toContain('"Ana ""Nina"" Souza"');
    expect(csv).toContain('"Societário; Contratos"');
    expect(csv).toContain("Confirmado;Presente;09:10");
  });
});
