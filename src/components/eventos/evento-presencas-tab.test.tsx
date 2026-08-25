import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EventoPresencasContent } from "./evento-presencas-tab";
import type { CafeAdminData } from "@/lib/cafe-cultura/types";

const data: CafeAdminData = {
  event: {
    id: "event-1",
    name: "Café com Cultura — Agosto 2026",
    eventDate: "2026-08-28",
    location: "Auditório",
    attendanceCutoffAt: null,
    checkinOpensAt: "2026-08-28T12:00:00.000Z",
    checkinClosesAt: "2026-08-28T15:00:00.000Z",
  },
  summary: { total: 1, expected: 1, excused: 0, excluded: 0, present: 0, pending: 1 },
  participants: [
    {
      id: "participant-1",
      userId: "user-1",
      name: "Ana Souza",
      email: "ana@bp.com",
      department: "Societário",
      avatarUrl: "https://example.com/ana.jpg",
      expectationStatus: "confirmed",
      expectationSource: "automatic_roster",
      checkinAt: null,
      checkinSource: null,
      responsumTicketCount: 0,
    },
  ],
  lastSync: null,
};

describe("EventoPresencasContent", () => {
  it("mostra indicadores, foto e ações do colaborador", () => {
    const html = renderToStaticMarkup(
      <EventoPresencasContent
        data={data}
        search=""
        status="all"
        busy={false}
        onParticipantChange={vi.fn()}
      />
    );
    expect(html).toContain("Confirmados para o local");
    expect(html).toContain("Ana Souza");
    expect(html).toContain("https://example.com/ana.jpg");
    expect(html).toContain("Registrar presença");
  });
});
