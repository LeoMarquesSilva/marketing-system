import { describe, expect, it } from "vitest";
import {
  DIETARY_NO_RESTRICTION,
  buildInviteMessage,
  classifyPhone,
  countBoard,
  dietarySummary,
  isInviteToken,
  parseGuestAnswer,
  stageOf,
  toggleDietary,
  type BoardInvite,
} from "./festa-convite";

function invite(patch: Partial<BoardInvite> = {}): BoardInvite {
  return {
    id: "1",
    name: "Cliente Teste",
    firstName: "Cliente",
    company: null,
    area: null,
    email: null,
    phone: classifyPhone(null),
    senderUserId: "u1",
    token: "abcdefghijklmnop",
    logoUrl: null,
    showLogo: true,
    sentAt: null,
    sentChannel: null,
    openedAt: null,
    attending: null,
    plusOne: false,
    plusOneName: null,
    dietary: null,
    respondedAt: null,
    ...patch,
  };
}

describe("parseGuestAnswer", () => {
  it("exige dizer se leva convidado e, se levar, o nome", () => {
    expect(parseGuestAnswer({ attending: true })).toBeNull();
    expect(parseGuestAnswer({ attending: true, plusOne: true, plusOneName: " " })).toBeNull();
    expect(parseGuestAnswer({ attending: true, plusOne: true, plusOneName: "  Ana   Lima " })).toEqual({
      attending: true,
      plusOne: true,
      plusOneName: "Ana Lima",
      dietary: { restrictions: ["nenhuma"], notes: null },
      plusOneDietary: { restrictions: ["nenhuma"], notes: null },
    });
  });

  it("descarta convidado e restrição de quem não vai", () => {
    expect(parseGuestAnswer({ attending: false, plusOne: true, plusOneName: "Ana", dietary: { restrictions: ["vegano"] } })).toEqual({
      attending: false,
      plusOne: false,
      plusOneName: null,
      dietary: null,
      plusOneDietary: null,
    });
  });

  it("ignora o nome e a restrição do convidado quando vai sem convidado", () => {
    const answer = parseGuestAnswer({ attending: true, plusOne: false, plusOneName: "Ana", plusOneDietary: { restrictions: ["vegano"] } });
    expect(answer?.plusOneName).toBeNull();
    expect(answer?.plusOneDietary).toBeNull();
  });

  it("restrição: só opções conhecidas, e alergia, religiosa e outra pedem o detalhe", () => {
    const base = { attending: true, plusOne: false };
    expect(parseGuestAnswer({ ...base, dietary: { restrictions: ["carnivoro"] } })).toBeNull();
    expect(parseGuestAnswer({ ...base, dietary: { restrictions: ["alergia"], notes: " " } })).toBeNull();
    expect(parseGuestAnswer({ ...base, dietary: { restrictions: ["nenhuma", "vegano", "vegano"], notes: "x" } })?.dietary).toEqual({
      restrictions: ["vegano"],
      notes: null,
    });
    expect(parseGuestAnswer({ ...base, dietary: { restrictions: ["alergia"], notes: "  camarão " } })?.dietary).toEqual({
      restrictions: ["alergia"],
      notes: "camarão",
    });
  });
});

describe("classifyPhone", () => {
  it("só celular abre conversa no WhatsApp", () => {
    expect(classifyPhone("(19) 98354-1053")).toEqual({ kind: "celular", waNumber: "5519983541053", display: "(19) 98354-1053" });
    expect(classifyPhone("+55 11 96639-0770").waNumber).toBe("5511966390770");
    expect(classifyPhone("(11) 4421-8701")).toEqual({ kind: "fixo", waNumber: null, display: "(11) 4421-8701" });
    expect(classifyPhone("9999").kind).toBe("revisar");
    expect(classifyPhone("  ").kind).toBe("sem");
  });
});

describe("buildInviteMessage", () => {
  const link = "https://www.orqestrai.com.br/convite/abcdefghijklmnop";

  it("leva o nome do cliente, do remetente, o prazo e o link", () => {
    const text = buildInviteMessage({ guestFirstName: "Bruna", senderFirstName: "Renato", closesAt: "2026-11-27T23:59:59-03:00", link });
    expect(text.startsWith("Olá, Bruna! Aqui é Renato, do Bismarchi | Pires.")).toBe(true);
    expect(text).toContain("mais 1 convidado");
    expect(text).toContain("Pedimos a gentileza de confirmar até 27/11:");
    expect(text.endsWith(link)).toBe(true);
  });

  it("sem remetente e sem prazo, não inventa nenhum dos dois", () => {
    const text = buildInviteMessage({ guestFirstName: "Bruna", senderFirstName: "", closesAt: null, link });
    expect(text.startsWith("Olá, Bruna!\n\n")).toBe(true);
    expect(text).toContain("confirmação de presença:\n");
    expect(text).not.toContain("confirmar até");
  });
});

describe("andamento", () => {
  it("a etapa segue o que já aconteceu", () => {
    expect(stageOf(invite({ senderUserId: null }))).toBe("sem_remetente");
    expect(stageOf(invite())).toBe("a_enviar");
    expect(stageOf(invite({ sentAt: "2026-11-10T12:00:00Z" }))).toBe("enviado");
    expect(stageOf(invite({ sentAt: "2026-11-10T12:00:00Z", openedAt: "2026-11-10T13:00:00Z" }))).toBe("abriu");
    expect(stageOf(invite({ attending: false }))).toBe("recusado");
  });

  it("conta as pessoas com os convidados", () => {
    const counts = countBoard([
      invite({ attending: true, plusOne: true, plusOneName: "Ana", sentAt: "x", openedAt: "x" }),
      invite({ attending: true, sentAt: "x", openedAt: "x" }),
      invite({ attending: false, sentAt: "x" }),
      invite({ senderUserId: null }),
    ]);
    expect(counts).toEqual({ total: 4, sent: 3, opened: 2, confirmed: 2, declined: 1, headcount: 3, noSender: 1 });
  });
});

describe("restrição alimentar", () => {
  it("Nenhuma e as demais opções se excluem", () => {
    const vegano = toggleDietary(DIETARY_NO_RESTRICTION, "vegano");
    expect(vegano.restrictions).toEqual(["vegano"]);
    expect(toggleDietary(vegano, "lactose").restrictions).toEqual(["vegano", "lactose"]);
    expect(toggleDietary(vegano, "vegano")).toEqual(DIETARY_NO_RESTRICTION);
    expect(toggleDietary(vegano, "nenhuma")).toEqual(DIETARY_NO_RESTRICTION);
  });

  it("o resumo separa o convidado e some quando ninguém tem restrição", () => {
    expect(dietarySummary(DIETARY_NO_RESTRICTION, null)).toBeNull();
    expect(dietarySummary({ restrictions: ["vegetariano"], notes: null }, { restrictions: ["alergia"], notes: "camarão" })).toBe(
      "Vegetariano · Convidado: Alergia alimentar (camarão)"
    );
    expect(dietarySummary(DIETARY_NO_RESTRICTION, { restrictions: ["gluten"], notes: null })).toBe(
      "Convidado: Sem glúten"
    );
  });
});

describe("isInviteToken", () => {
  it("aceita só o formato do link pessoal", () => {
    expect(isInviteToken("AbC-_123xyzQWE45")).toBe(true);
    expect(isInviteToken("exemplo")).toBe(false);
    expect(isInviteToken("abc/../etc/passwd")).toBe(false);
  });
});
