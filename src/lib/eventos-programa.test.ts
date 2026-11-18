import { describe, expect, it } from "vitest";
import {
  daysUntil,
  formatClock,
  formatMinutes,
  groupMenu,
  parseParticipants,
  participantCounts,
  scheduleRows,
  scheduleTotals,
  splitTastings,
  tastingLinkHref,
  type EventMenuItem,
  type EventScheduleItem,
  type EventTasting,
} from "./eventos-programa";

function block(startTime: string, endTime: string, kind: EventScheduleItem["kind"], partial: Partial<EventScheduleItem> = {}): EventScheduleItem {
  return { id: `${startTime}-${kind}`, scheduleId: "s1", eventId: "e1", startTime, endTime, title: kind, kind, note: null, removed: false, sortOrder: 0, ...partial };
}

const night = [
  block("22:40", "00:10", "show"),
  block("18:00", "19:00", "dj"),
  block("19:00", "19:30", "fala"),
  block("19:30", "19:40", "fala", { id: "depoimento", removed: true }),
  block("19:40", "20:20", "premiacao"),
  block("20:20", "20:35", "fala"),
  block("20:35", "22:00", "show"),
  block("22:00", "22:40", "dj"),
  block("00:10", "01:00", "dj"),
];

describe("cronograma", () => {
  it("ordena atravessando a meia-noite e mostra o intervalo do bloco retirado", () => {
    const rows = scheduleRows(night);
    expect(rows[0]).toMatchObject({ type: "item", minutes: 60 });
    expect(rows.filter((row) => row.type === "gap")).toEqual([{ type: "gap", startTime: "19:30", endTime: "19:40", minutes: 10 }]);
    const last = rows[rows.length - 1];
    expect(last.type === "item" && last.item.endTime).toBe("01:00");
  });

  it("soma por tipo sem os blocos retirados", () => {
    const totals = scheduleTotals(night);
    expect(totals).toMatchObject({ startTime: "18:00", endTime: "01:00", showBlocks: 2 });
    expect(totals.byKind).toMatchObject({ show: 175, fala: 45, premiacao: 40, dj: 150 });
  });

  it("escreve horário e duração do jeito que se fala", () => {
    expect(formatClock("19:30")).toBe("19h30");
    expect(formatClock("01:00")).toBe("01h");
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(120)).toBe("2h");
    expect(formatMinutes(175)).toBe("2h55");
  });
});

describe("cardápio e degustações", () => {
  const dish = (section: string, name: string, sortOrder: number, menuType: EventMenuItem["menuType"] = "comida"): EventMenuItem => ({
    id: name, eventId: "e1", menuType, section, name, note: null, highlight: false, status: "aprovado", vendorName: null, sortOrder,
  });
  const tasting = (vendorName: string, tastingDate: string, status: EventTasting["status"], menuType: EventTasting["menuType"] = "bebida"): EventTasting => ({
    id: vendorName, eventId: "e1", menuType, vendorName, tastingDate, tastingTime: "19:00", location: null, linkUrl: null, status, resultNote: null, participants: [], sortOrder: 0,
  });

  it("agrupa o cardápio por momento, na ordem em que aparece", () => {
    const sections = groupMenu([dish("Jantar", "Risoto", 3), dish("Estação gourmet", "Carpaccio", 1), dish("jantar", "Escalope", 2), dish("Drinks", "Gin", 1, "bebida")], "comida");
    expect(sections.map((section) => [section.section, section.items.map((item) => item.name)])).toEqual([
      ["Estação gourmet", ["Carpaccio"]],
      ["jantar", ["Escalope", "Risoto"]],
    ]);
  });

  it("separa as degustações marcadas das já feitas", () => {
    const { upcoming, done } = splitTastings(
      [tasting("Clico", "2026-11-18", "agendada"), tasting("Madison", "2026-11-12", "agendada"), tasting("Outro", "2026-10-01", "realizada"), tasting("Cancelado", "2026-11-01", "cancelada"), tasting("Buffet", "2026-10-14", "realizada", "comida")],
      "bebida"
    );
    expect(upcoming.map((entry) => entry.vendorName)).toEqual(["Madison", "Clico"]);
    expect(done.map((entry) => entry.vendorName)).toEqual(["Outro"]);
  });

  it("lê os participantes e conta quem falta confirmar", () => {
    const people = parseParticipants([{ name: " Ricardo ", userId: "u1" }, { name: "Felipe", status: "a_confirmar", note: "Confirmar se vai" }, { name: "" }, null]);
    expect(people).toEqual([
      { name: "Ricardo", userId: "u1", status: "confirmado", note: null },
      { name: "Felipe", userId: null, status: "a_confirmar", note: "Confirmar se vai" },
    ]);
    expect(participantCounts(people)).toEqual({ confirmed: 1, pending: 1 });
    expect(parseParticipants("x")).toEqual([]);
  });

  it("conta os dias até a degustação e só aceita link https", () => {
    expect(daysUntil("2026-11-12", "2026-11-10")).toBe(2);
    expect(daysUntil("2026-11-09", "2026-11-10")).toBe(-1);
    expect(daysUntil(null, "2026-11-10")).toBeNull();
    expect(tastingLinkHref("https://www.instagram.com/clicocoquetelaria")).toBe("https://www.instagram.com/clicocoquetelaria");
    expect(tastingLinkHref("javascript:alert(1)")).toBeNull();
  });
});
