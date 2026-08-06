import { describe, expect, it } from "vitest";
import { buildEligibleRespondents } from "@/lib/nps/eligible";
import { generateNpsToken, isValidNpsToken } from "@/lib/nps/token";
import { buildNpsWhatsAppMessage } from "@/lib/nps/message";
import { getNpsPublicUrl } from "@/lib/nps/public-url";

const GROUP = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe("buildEligibleRespondents", () => {
  it("inclui apenas nps_eligible do grupo", () => {
    const result = buildEligibleRespondents(
      [
        {
          id: "c1",
          name: "Ana",
          email: "ana@x.com",
          cargo: "Diretora",
          npsEligible: true,
          clientGroupId: GROUP,
        },
        {
          id: "c2",
          name: "Bruno",
          email: "bruno@x.com",
          cargo: null,
          npsEligible: false,
          clientGroupId: GROUP,
        },
      ],
      [
        {
          id: "p1",
          name: "Carla",
          email: "carla@x.com",
          cargo: "Gerente",
          npsEligible: true,
          clientGroupId: GROUP,
        },
      ],
      GROUP
    );

    expect(result.map((r) => r.name)).toEqual(["Ana", "Carla"]);
    expect(result[0].kind).toBe("contact");
    expect(result[1].kind).toBe("person");
  });

  it("deduplica pessoa com mesmo e-mail de contato", () => {
    const result = buildEligibleRespondents(
      [
        {
          id: "c1",
          name: "Ana Silva",
          email: "ana@x.com",
          cargo: null,
          npsEligible: true,
          clientGroupId: GROUP,
        },
      ],
      [
        {
          id: "p1",
          name: "Ana S.",
          email: "ana@x.com",
          cargo: null,
          npsEligible: true,
          clientGroupId: GROUP,
        },
      ],
      GROUP
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("c1");
  });

  it("deduplica pessoa com mesmo nome de contato", () => {
    const result = buildEligibleRespondents(
      [
        {
          id: "c1",
          name: "João Souza",
          email: "joao@x.com",
          cargo: null,
          npsEligible: true,
          clientGroupId: GROUP,
        },
      ],
      [
        {
          id: "p1",
          name: "João Souza",
          email: null,
          cargo: null,
          npsEligible: true,
          clientGroupId: GROUP,
        },
      ],
      GROUP
    );
    expect(result).toHaveLength(1);
  });
});

describe("token / url / message", () => {
  it("gera token válido com prefixo nps_", () => {
    const token = generateNpsToken();
    expect(token.startsWith("nps_")).toBe(true);
    expect(isValidNpsToken(token)).toBe(true);
    expect(isValidNpsToken("nfc_abc")).toBe(false);
    expect(isValidNpsToken("nps_short")).toBe(false);
  });

  it("monta URL pública", () => {
    const url = getNpsPublicUrl("nps_abcdefghijklmnopqrstuv", {
      NEXT_PUBLIC_APP_URL: "https://app.example.com/",
    });
    expect(url).toBe("https://app.example.com/nps/nps_abcdefghijklmnopqrstuv");
  });

  it("monta mensagem WhatsApp com link e grupo", () => {
    const msg = buildNpsWhatsAppMessage({
      groupName: "Acme Corp",
      surveyUrl: "https://app.example.com/nps/nps_xyz",
      campaignName: "NPS 2026",
    });
    expect(msg).toContain("Acme Corp");
    expect(msg).toContain("NPS 2026");
    expect(msg).toContain("https://app.example.com/nps/nps_xyz");
    expect(msg).toContain("selecione o seu nome");
  });
});
