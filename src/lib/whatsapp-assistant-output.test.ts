import { describe, expect, it } from "vitest";
import { cleanVersions, resolveAssistantActions, shortName } from "./whatsapp-assistant-output";
import { contactShareText, parseContactBody } from "./whatsapp-team-contacts";
import type { TeamContact } from "./whatsapp-team-contacts";

const person = (id: string, name: string, extra: Partial<TeamContact> = {}): TeamContact => ({
  id,
  name,
  avatarUrl: null,
  position: "Coordenador",
  area: "Contratos",
  email: `${id}@bismarchipires.com.br`,
  cardPhone: null,
  isLeader: true,
  ...extra,
});

describe("saída da IA do atendimento", () => {
  it("encurta o nome para o botão", () => {
    expect(shortName("Henrique Franco Nascimento")).toBe("Henrique Nascimento");
    expect(shortName("Daniel Pressatto")).toBe("Daniel Pressatto");
  });

  it("põe a versão curta primeiro e tira repetidas", () => {
    const versions = cleanVersions(
      [
        { tipo: "completa", texto: "Texto longo" },
        { tipo: "curta", texto: "Curto" },
        { tipo: "curta", texto: "Curto" },
      ],
      2
    );
    expect(versions).toEqual([
      { kind: "curta", text: "Curto" },
      { kind: "completa", text: "Texto longo" },
    ]);
  });

  it("troca os códigos por pessoas e descarta o que não serve", () => {
    const team = [person("u1", "Henrique Franco Nascimento"), person("u2", "Ricardo Viscardi Pires", { cardPhone: "5519999999999" })];
    const idByRef = new Map([
      ["p1", "u1"],
      ["p2", "u2"],
    ]);
    const actions = resolveAssistantActions(
      [
        { tipo: "enviar_cartao", pessoa: "recepcao" },
        { tipo: "encaminhar_lead", pessoa: "[p1]" },
        { tipo: "encaminhar_lead", pessoa: "p1" },
        { tipo: "encaminhar_lead", pessoa: "recepcao" },
        { tipo: "enviar_cartao", pessoa: "p9" },
        { tipo: "enviar_cartao", pessoa: "p2" },
      ],
      { idByRef, team }
    );
    expect(actions).toEqual([
      { type: "send_contact", contactId: "recepcao", label: "Enviar contato da Recepção" },
      { type: "forward_lead", contactId: "u1", label: "Encaminhar para Henrique Nascimento" },
      { type: "send_contact", contactId: "u2", label: "Enviar contato de Ricardo Pires" },
    ]);
  });

  it("monta a frase do contato com área e e-mail", () => {
    expect(
      contactShareText(
        { kind: "team", person: { name: "Henrique Franco Nascimento", area: "Contratos", email: "h@bismarchipires.com.br" } },
        { email: true, card: false }
      )
    ).toBe("Segue o contato de Henrique Franco Nascimento, da área de Contratos:\nE-mail: h@bismarchipires.com.br");
    expect(
      contactShareText(
        { kind: "team", person: { name: "Gustavo Bismarchi Motta", area: "Sócio", email: null } },
        { email: true, card: true }
      )
    ).toBe("Segue o contato de Gustavo Bismarchi Motta 👇");
  });
});

describe("cartão de contato na conversa", () => {
  it("lê nome e telefone do texto gravado", () => {
    expect(parseContactBody("[contato] Recepção Bismarchi | Pires · +5519994002573")).toEqual({
      name: "Recepção Bismarchi | Pires",
      phone: "(19) 99400-2573",
    });
    expect(parseContactBody("[contato]")).toEqual({ name: null, phone: null });
    expect(parseContactBody("Olá")).toBeNull();
  });
});
