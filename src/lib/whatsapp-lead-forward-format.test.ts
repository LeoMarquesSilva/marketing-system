import { describe, expect, it } from "vitest";
import {
  brazilPhoneVariants,
  buildLeadForwardMessage,
  formatBrazilPhone,
  formatLeadPhone,
  isLeaderPosition,
  leadContactCard,
  matchesRecipientSearch,
  normalizeBrazilPhone,
  sortForwardRecipients,
  type LeadForwardRecipient,
} from "@/lib/whatsapp-lead-forward-format";
import { isTeamConversation } from "../../supabase/functions/evolution-webhook/lead-push-format";

describe("normalizeBrazilPhone", () => {
  it("põe o 55 em telefone com DDD", () => {
    expect(normalizeBrazilPhone("(19) 99988-7766")).toBe("5519999887766");
    expect(normalizeBrazilPhone("19 3344-5566")).toBe("551933445566");
  });

  it("mantém quem já tem DDI e recusa o que não é telefone", () => {
    expect(normalizeBrazilPhone("+55 19 99988-7766")).toBe("5519999887766");
    expect(normalizeBrazilPhone("99887766")).toBeNull();
    expect(normalizeBrazilPhone("")).toBeNull();
    expect(normalizeBrazilPhone(null)).toBeNull();
  });
});

describe("brazilPhoneVariants", () => {
  it("cobre com e sem 55 e com e sem o nono dígito", () => {
    expect(brazilPhoneVariants("19999887766").sort()).toEqual(
      ["1999887766", "19999887766", "551999887766", "5519999887766"].sort()
    );
  });

  it("fixo não ganha nono dígito", () => {
    expect(brazilPhoneVariants("1933445566").sort()).toEqual(["1933445566", "551933445566"].sort());
  });
});

describe("formatação de telefone", () => {
  it("formata celular e fixo do Brasil", () => {
    expect(formatBrazilPhone("5519999887766")).toBe("(19) 99988-7766");
    expect(formatBrazilPhone("1933445566")).toBe("(19) 3344-5566");
  });

  it("lead estrangeiro sai com +", () => {
    expect(formatLeadPhone("5519999887766")).toBe("(19) 99988-7766");
    expect(formatLeadPhone("14155552671")).toBe("+14155552671");
    expect(formatLeadPhone(null)).toBeNull();
  });
});

describe("isLeaderPosition", () => {
  it("reconhece cargos de liderança sem depender de acento", () => {
    for (const position of ["Sócio de Área", "Sócio Patrimonial", "Coordenador Comercial", "Gerente", "Supervisor"]) {
      expect(isLeaderPosition(position)).toBe(true);
    }
    for (const position of ["Advogado Sênior", "Estagiário", null]) {
      expect(isLeaderPosition(position)).toBe(false);
    }
  });
});

describe("lista de quem recebe", () => {
  const person = (name: string, isLeader: boolean, position: string | null = null, area: string | null = null) =>
    ({ userId: name, name, avatarUrl: null, position, area, phone: "5519999887766", isLeader }) satisfies LeadForwardRecipient;

  it("liderança primeiro, depois ordem alfabética", () => {
    const sorted = sortForwardRecipients([person("Bruno", false), person("Carla", true), person("Ana", false), person("Bia", true)]);
    expect(sorted.map((r) => r.name)).toEqual(["Bia", "Carla", "Ana", "Bruno"]);
  });

  it("busca por nome, cargo ou área sem acento", () => {
    const carla = person("Carla", true, "Sócio de Área", "Trabalhista");
    expect(matchesRecipientSearch(carla, "socio")).toBe(true);
    expect(matchesRecipientSearch(carla, "trabal")).toBe(true);
    expect(matchesRecipientSearch(carla, "civel")).toBe(false);
    expect(matchesRecipientSearch(carla, "  ")).toBe(true);
  });
});

describe("buildLeadForwardMessage", () => {
  it("monta cabeçalho, resumo e quem encaminhou", () => {
    expect(
      buildLeadForwardMessage({
        leadName: "Maria Souza",
        leadPhone: "5519999887766",
        origin: "Anúncio Meta",
        campaign: "Trabalhista - Leads",
        summary: "- Empresa de 40 funcionários\n- Quer revisar contratos",
        senderName: "Leonardo Marques Silva",
      })
    ).toBe(
      [
        "*Lead do WhatsApp*",
        "Nome: Maria Souza",
        "WhatsApp: (19) 99988-7766",
        "Origem: Anúncio Meta · Trabalhista - Leads",
        "",
        "*Resumo da conversa*",
        "- Empresa de 40 funcionários\n- Quer revisar contratos",
        "",
        "Encaminhado por Leonardo pelo ORQESTRAI",
      ].join("\n")
    );
  });

  it("sem telefone, origem nem remetente, só o que existe", () => {
    expect(
      buildLeadForwardMessage({ leadName: "Contato", leadPhone: null, origin: null, campaign: null, summary: "", senderName: null })
    ).toBe(["*Lead do WhatsApp*", "Nome: Contato", "", "*Resumo da conversa*", "-"].join("\n"));
  });
});

describe("leadContactCard", () => {
  it("usa o telefone do WhatsApp com DDI", () => {
    expect(leadContactCard("Maria", "5519999887766")).toEqual({
      fullName: "Maria",
      wuid: "5519999887766",
      phoneNumber: "+5519999887766",
    });
    expect(leadContactCard("", "5519999887766")?.fullName).toBe("(19) 99988-7766");
  });

  it("sem telefone visível (número oculto), não há cartão", () => {
    expect(leadContactCard("Maria", null)).toBeNull();
  });
});

describe("isTeamConversation", () => {
  it("tag Colaborador marca conversa com a equipe", () => {
    expect(isTeamConversation(["Colaborador"])).toBe(true);
    expect(isTeamConversation(["colaborador", "Site"])).toBe(true);
    expect(isTeamConversation(["Tráfego pago"])).toBe(false);
    expect(isTeamConversation(null)).toBe(false);
  });
});
