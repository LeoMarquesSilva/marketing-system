import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CafeCheckinView } from "./cafe-checkin-client";
import type { CafeCurrentView } from "@/lib/cafe-cultura/types";

const base: CafeCurrentView = {
  event: {
    id: "event-1",
    name: "Café com Cultura — Agosto 2026",
    eventDate: "2026-08-28",
    location: "Auditório",
    attendanceCutoffAt: null,
    checkinOpensAt: "2026-08-28T12:00:00.000Z",
    checkinClosesAt: "2026-08-28T15:00:00.000Z",
  },
  collaborator: {
    id: "user-1",
    name: "Ana Souza",
    avatarUrl: null,
    expectationStatus: "confirmed",
    checkinAt: null,
  },
  windowState: "open",
};

describe("CafeCheckinView", () => {
  it("mostra a identidade do colaborador e ação própria quando está aberto", () => {
    const html = renderToStaticMarkup(
      <CafeCheckinView current={base} busy={false} error="" onCheckin={vi.fn()} />
    );
    expect(html).toContain("Olá, Ana");
    expect(html).toContain("Confirmar minha presença");
    expect(html).not.toContain("Selecione seu nome");
  });

  it("mostra o horário original quando o check-in já foi registrado", () => {
    const html = renderToStaticMarkup(
      <CafeCheckinView
        current={{ ...base, collaborator: { ...base.collaborator, checkinAt: "2026-08-28T12:15:00.000Z" } }}
        busy={false}
        error=""
        onCheckin={vi.fn()}
      />
    );
    expect(html).toContain("Presença confirmada");
    expect(html).toContain("09:15");
  });

  it("não oferece ação depois do encerramento", () => {
    const html = renderToStaticMarkup(
      <CafeCheckinView current={{ ...base, windowState: "closed" }} busy={false} error="" onCheckin={vi.fn()} />
    );
    expect(html).toContain("Check-in encerrado");
    expect(html).not.toContain("Confirmar minha presença");
  });
});
