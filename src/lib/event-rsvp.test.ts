import { describe, expect, it } from "vitest";
import {
  countRsvp,
  firstNameOf,
  formatRsvpDeadline,
  isRsvpOpen,
  parseRsvpAnswer,
  type RsvpPerson,
} from "./event-rsvp";

function person(status: RsvpPerson["status"], transport: RsvpPerson["transport"] = null): RsvpPerson {
  return {
    inviteId: Math.random().toString(36),
    name: "Pessoa",
    shortName: "Pessoa",
    department: null,
    avatarUrl: null,
    status,
    transport,
    respondedAt: null,
    dietary: null,
  };
}

describe("parseRsvpAnswer", () => {
  it("exige o transporte de quem vai", () => {
    expect(parseRsvpAnswer({ attending: true })).toBeNull();
    expect(parseRsvpAnswer({ attending: true, transport: "carro" })).toBeNull();
    expect(parseRsvpAnswer({ attending: true, transport: "so_ida" })).toEqual({ attending: true, transport: "so_ida" });
  });

  it("descarta o transporte de quem não vai", () => {
    expect(parseRsvpAnswer({ attending: false, transport: "ida_volta" })).toEqual({ attending: false, transport: null });
  });

  it("recusa corpo inválido", () => {
    expect(parseRsvpAnswer(null)).toBeNull();
    expect(parseRsvpAnswer({ attending: "sim" })).toBeNull();
  });
});

describe("countRsvp", () => {
  it("conta ida e volta do micro-ônibus só de quem vai", () => {
    const counts = countRsvp([
      person("confirmado", "ida_volta"),
      person("confirmado", "so_ida"),
      person("confirmado", "so_volta"),
      person("confirmado", "nao"),
      person("recusado"),
      person("sem_resposta"),
    ]);
    expect(counts).toEqual({ confirmed: 4, declined: 1, pending: 1, outbound: 2, returning: 2 });
  });
});

describe("prazo", () => {
  const closesAt = "2026-11-13T23:59:59-03:00";

  it("fica aberto até o fim do dia 13/11 em Brasília", () => {
    expect(isRsvpOpen(closesAt, new Date("2026-11-13T23:00:00-03:00"))).toBe(true);
    expect(isRsvpOpen(closesAt, new Date("2026-11-14T00:00:01-03:00"))).toBe(false);
    expect(isRsvpOpen(null)).toBe(false);
  });

  it("formata no horário de Brasília", () => {
    expect(formatRsvpDeadline(closesAt)).toBe("13/11");
    expect(formatRsvpDeadline(closesAt, true)).toBe("13/11 às 23h59");
  });
});

describe("firstNameOf", () => {
  it("pula partículas", () => {
    expect(firstNameOf("Caroline Thomé")).toBe("Caroline");
    expect(firstNameOf("de Souza")).toBe("Souza");
  });
});
