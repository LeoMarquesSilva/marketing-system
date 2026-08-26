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
      responsumJustifications: [],
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
    expect(html).toContain("Presença");
    expect(html).toContain("Sem justificativa registrada");
  });

  it("mostra o texto sincronizado do RESPONSUM", () => {
    const justified: CafeAdminData = {
      ...data,
      summary: { total: 1, expected: 0, excused: 1, excluded: 0, present: 0, pending: 0 },
      participants: [
        {
          ...data.participants[0]!,
          expectationStatus: "excused_absence",
          expectationSource: "responsum",
          responsumTicketCount: 1,
          responsumJustifications: [
            {
              ticketId: "ticket-1",
              title: "Justificativa 28/08",
              description: "Consulta médica previamente agendada.",
            },
          ],
        },
      ],
    };

    const html = renderToStaticMarkup(
      <EventoPresencasContent
        data={justified}
        search=""
        status="all"
        busy={false}
        onParticipantChange={vi.fn()}
      />
    );

    expect(html).toContain("Consulta médica previamente agendada.");
    expect(html).toContain("RESPONSUM");
  });
});
