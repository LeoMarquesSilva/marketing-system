import { describe, expect, it } from "vitest";
import {
  formatPersonDisplayName,
  findInviteTwinsInGroup,
  inviteTwinMatches,
  isPersonNamePrefix,
  personNameKey,
} from "@/lib/email-marketing-normalize";

describe("formatPersonDisplayName", () => {
  it("converte ALL CAPS para title case", () => {
    expect(formatPersonDisplayName("ANDRE ANSELMO CASTILHO")).toBe("Andre Anselmo Castilho");
    expect(formatPersonDisplayName("FERNANDA ANSELMO CASTILHO GASPAROTTO")).toBe(
      "Fernanda Anselmo Castilho Gasparotto"
    );
  });

  it("mantém partículas em minúsculas no meio do nome", () => {
    expect(formatPersonDisplayName("MARIA DA SILVA")).toBe("Maria da Silva");
    expect(formatPersonDisplayName("JOSE DE SOUZA")).toBe("Jose de Souza");
  });

  it("preserva deduplicação RD × SIOE após formatação", () => {
    expect(personNameKey(formatPersonDisplayName("ANDRE ANSELMO CASTILHO"))).toBe(
      personNameKey("Andre Anselmo Castilho")
    );
  });
});

describe("inviteTwinMatches", () => {
  it("pareia contato RD e pessoa SIOE pelo nome", () => {
    expect(
      inviteTwinMatches(
        { name: "Guilherme Amador Cará", email: "guilhermecaraadv@gmail.com" },
        { name: "Guilherme Amador Cará", email: null }
      )
    ).toBe(true);
  });

  it("reconhece nome abreviado como prefixo", () => {
    expect(isPersonNamePrefix("Elaine Louzada", "Elaine Louzada Castilho")).toBe(true);
    expect(isPersonNamePrefix("Vivian", "Vivian Helena Capacle Correa")).toBe(false);
  });

  it("não junta Valter Ribeiro com Valter Ribeiro Filho se o Filho já tem par exato", () => {
    const people = [
      { id: "p-valter", name: "Valter Ribeiro", email: null },
      { id: "p-filho", name: "Valter Ribeiro Filho", email: null },
    ];
    const contacts = [
      { id: "c-filho", name: "Valter Ribeiro Filho", email: "v@example.com" },
    ];
    expect(findInviteTwinsInGroup(contacts[0], people, contacts).map((p) => p.id)).toEqual([
      "p-filho",
    ]);
    expect(findInviteTwinsInGroup(people[0], contacts, people)).toEqual([]);
  });
});
