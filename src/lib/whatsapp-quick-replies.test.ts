import { describe, expect, it } from "vitest";
import {
  contactFirstName,
  fillQuickReply,
  firstPlaceholderRange,
  greetingFor,
  insertQuickReply,
  matchQuickReplies,
  normalizeShortcut,
  slashQuery,
  type QuickReply,
} from "./whatsapp-quick-replies";

const reply = (shortcut: string, title: string, body: string, use_count = 0): QuickReply => ({
  id: shortcut,
  shortcut,
  title,
  category: "duvidas",
  body,
  sort_order: 0,
  use_count,
});

describe("respostas prontas", () => {
  it("monta a saudação pelo horário de Brasília", () => {
    expect(greetingFor(new Date("2026-11-04T12:00:00Z"))).toBe("Bom dia"); // 9h
    expect(greetingFor(new Date("2026-11-04T18:00:00Z"))).toBe("Boa tarde"); // 15h
    expect(greetingFor(new Date("2026-11-04T23:30:00Z"))).toBe("Boa noite"); // 20h30
  });

  it("tira o primeiro nome apresentável do WhatsApp", () => {
    expect(contactFirstName("sthe 💕")).toBe("Sthe");
    expect(contactFirstName("Symyra MARA")).toBe("Symyra");
    expect(contactFirstName("+55 (19) 99999-0000")).toBe("");
    expect(contactFirstName("💼 João Paulo")).toBe("João");
    expect(contactFirstName(null)).toBe("");
  });

  it("preenche as variáveis e some com o nome quando não há", () => {
    const now = new Date("2026-11-04T18:00:00Z");
    const body = "{saudacao}, {nome}! Meu nome é {atendente}. Entendi a urgência, {nome}.";
    expect(fillQuickReply(body, { contactName: "tiago cerqueira", attendantName: "Leonardo Marques", now })).toBe(
      "Boa tarde, Tiago! Meu nome é Leonardo. Entendi a urgência, Tiago."
    );
    expect(fillQuickReply(body, { contactName: "5519999990000", attendantName: "Leonardo", now })).toBe(
      "Boa tarde! Meu nome é Leonardo. Entendi a urgência."
    );
    expect(fillQuickReply("Sou {atendente}.", { now })).toBe("Sou [seu nome].");
  });

  it("acha o primeiro colchete para completar", () => {
    const text = "Vou passar para [advogado], da área [área].";
    const range = firstPlaceholderRange(text);
    expect(range && text.slice(range.start, range.end)).toBe("[advogado]");
    expect(firstPlaceholderRange("Sem nada")).toBeNull();
  });

  it("reconhece a barra só no fim, no começo do campo ou depois de espaço", () => {
    expect(slashQuery("/tri")).toEqual({ query: "tri", start: 0 });
    expect(slashQuery("Oi /")).toEqual({ query: "", start: 3 });
    expect(slashQuery("http://site")).toBeNull();
    expect(slashQuery("/tri depois")).toBeNull();
  });

  it("insere no lugar do atalho ou no fim do texto", () => {
    expect(insertQuickReply("/tri", "Texto")).toBe("Texto");
    expect(insertQuickReply("Desculpe a demora. /val", "Texto")).toBe("Desculpe a demora. Texto");
    expect(insertQuickReply("Olá!  ", "Texto")).toBe("Olá!\n\nTexto");
    expect(insertQuickReply("", "Texto")).toBe("Texto");
  });

  it("busca pelo atalho primeiro e sem acento", () => {
    const list = [
      reply("valor", "Quanto custa", "O valor depende do caso", 1),
      reply("pf", "Atende pessoa física?", "Atendemos, sim"),
      reply("curriculo", "Currículo ou estágio", "Obrigado pelo interesse", 5),
    ];
    expect(matchQuickReplies(list, "va").map((r) => r.shortcut)).toEqual(["valor"]);
    expect(matchQuickReplies(list, "fisica").map((r) => r.shortcut)).toEqual(["pf"]);
    expect(matchQuickReplies(list, "").map((r) => r.shortcut)).toEqual(["curriculo", "valor", "pf"]);
    expect(normalizeShortcut("/Currículo RH")).toBe("curriculo-rh");
  });
});
