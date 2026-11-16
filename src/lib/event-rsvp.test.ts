import { describe, expect, it } from "vitest";
import {
  countRsvp,
  firstNameOf,
  formatRsvpDeadline,
  isRsvpOpen,
  parseRsvpAnswer,
  personalDeadline,
  type RsvpPerson,
} from "./event-rsvp";

function person(status: RsvpPerson["status"], transport: RsvpPerson["transport"] = null, plusOneName: string | null = null): RsvpPerson {
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
    plusOneName,
    plusOneDietary: null,
  };
}

const SEM_ACOMPANHANTE = { plusOne: false, plusOneName: null, plusOneDietary: null, dietary: null };

describe("parseRsvpAnswer", () => {
  it("exige o transporte de quem vai", () => {
    expect(parseRsvpAnswer({ attending: true })).toBeNull();
    expect(parseRsvpAnswer({ attending: true, transport: "carro" })).toBeNull();
    expect(parseRsvpAnswer({ attending: true, transport: "so_ida" })).toEqual({ attending: true, transport: "so_ida", ...SEM_ACOMPANHANTE });
  });

  it("descarta o transporte de quem não vai", () => {
    expect(parseRsvpAnswer({ attending: false, transport: "ida_volta", plusOne: true, plusOneName: "Ana" })).toEqual({ attending: false, transport: null, ...SEM_ACOMPANHANTE });
  });

  it("aceita o acompanhante com nome e restrição", () => {
    expect(
      parseRsvpAnswer({ attending: true, transport: "nao", plusOne: true, plusOneName: "  Ana   Lima ", plusOneDietary: { restrictions: ["vegetariano"], notes: null } })
    ).toEqual({ attending: true, transport: "nao", plusOne: true, plusOneName: "Ana Lima", plusOneDietary: { restrictions: ["vegetariano"], notes: null }, dietary: null });
  });

  it("exige o nome do acompanhante", () => {
    expect(parseRsvpAnswer({ attending: true, transport: "nao", plusOne: true, plusOneName: " " })).toBeNull();
    expect(parseRsvpAnswer({ attending: true, transport: "nao", plusOne: "sim" })).toBeNull();
  });

  it("lê a restrição de quem não tem ficha e recusa opção desconhecida", () => {
    expect(parseRsvpAnswer({ attending: true, transport: "nao", dietary: { restrictions: ["gluten"], notes: null } })?.dietary).toEqual({ restrictions: ["gluten"], notes: null });
    expect(parseRsvpAnswer({ attending: true, transport: "nao", dietary: { restrictions: ["pizza"], notes: null } })).toBeNull();
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
    expect(counts).toEqual({ confirmed: 4, declined: 1, pending: 1, companions: 0, headcount: 4, outbound: 2, returning: 2, riders: 3 });
  });

  it("o acompanhante conta na festa e no micro-ônibus de quem o leva", () => {
    const counts = countRsvp([person("confirmado", "ida_volta", "Ana"), person("confirmado", "nao", "Bia"), person("recusado", null, "Caio")]);
    expect(counts).toMatchObject({ confirmed: 2, companions: 2, headcount: 4, outbound: 2, returning: 2, riders: 2 });
  });
});

describe("prazo", () => {
  const closesAt = "2026-11-13T23:59:59-03:00";

  it("o prazo do convite só vale se for mais longo e não reabre a confirmação desligada", () => {
    const terca = "2026-11-17T23:59:59-03:00";
    expect(personalDeadline(closesAt, null)).toBe(closesAt);
    expect(personalDeadline(closesAt, terca)).toBe(terca);
    expect(personalDeadline(closesAt, "2026-11-10T23:59:59-03:00")).toBe(closesAt);
    expect(personalDeadline(null, terca)).toBeNull();
    expect(isRsvpOpen(personalDeadline(closesAt, terca), new Date("2026-11-16T10:00:00-03:00"))).toBe(true);
    expect(isRsvpOpen(personalDeadline(closesAt, null), new Date("2026-11-16T10:00:00-03:00"))).toBe(false);
  });

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
