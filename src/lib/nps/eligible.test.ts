import { describe, expect, it } from "vitest";
import {
  buildEligibleRespondents,
  computeNpsOutreachProgress,
  isNpsOutreachCandidate,
  NPS_OUTREACH_NO_AREA,
  NPS_OUTREACH_NO_SENDER,
  resolveNpsCollectionArea,
} from "@/lib/nps/eligible";
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

  it("com includeUnclassified inclui pendentes e exclui NPS não", () => {
    const result = buildEligibleRespondents(
      [
        {
          id: "c-yes",
          name: "Ana",
          email: "ana@x.com",
          cargo: null,
          npsEligible: true,
          invitesClassifiedByUserId: "user-1",
          clientGroupId: GROUP,
        },
        {
          id: "c-pending",
          name: "Bruno",
          email: "bruno@x.com",
          cargo: null,
          npsEligible: false,
          invitesClassifiedByUserId: null,
          clientGroupId: GROUP,
        },
        {
          id: "c-no",
          name: "Carla",
          email: "carla@x.com",
          cargo: null,
          npsEligible: false,
          invitesClassifiedByUserId: "user-1",
          clientGroupId: GROUP,
        },
      ],
      [],
      GROUP,
      { includeUnclassified: true }
    );

    expect(result.map((r) => r.name)).toEqual(["Ana", "Bruno"]);
  });

  it("sem includeUnclassified continua só com NPS sim", () => {
    const result = buildEligibleRespondents(
      [
        {
          id: "c-pending",
          name: "Bruno",
          email: "bruno@x.com",
          cargo: null,
          npsEligible: false,
          invitesClassifiedByUserId: null,
          clientGroupId: GROUP,
        },
      ],
      [],
      GROUP
    );
    expect(result).toHaveLength(0);
  });
});

describe("isNpsOutreachCandidate", () => {
  it("aceita NPS sim e pendente; recusa NPS não explícito", () => {
    expect(
      isNpsOutreachCandidate({ npsEligible: true, invitesClassifiedByUserId: "user-1" })
    ).toBe(true);
    expect(
      isNpsOutreachCandidate({ npsEligible: false, invitesClassifiedByUserId: null })
    ).toBe(true);
    expect(
      isNpsOutreachCandidate({ npsEligible: false, invitesClassifiedByUserId: "user-1" })
    ).toBe(false);
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

describe("computeNpsOutreachProgress", () => {
  it("conta pessoas e grupos com pelo menos um elegível", () => {
    const progress = computeNpsOutreachProgress({
      eligibleCountByGroupId: { g1: 3, g2: 0, g3: 2 },
      sentGroupIds: ["g1", "g9"],
      respondedPeople: 1,
    });
    expect(progress).toEqual({
      eligiblePeople: 5,
      eligibleGroups: 2,
      sentGroups: 1,
      respondedPeople: 1,
      byArea: [],
    });
  });

  it("não conta envio de grupo sem elegível", () => {
    const progress = computeNpsOutreachProgress({
      eligibleCountByGroupId: new Map([["g1", 2]]),
      sentGroupIds: ["g2"],
      respondedPeople: 0,
    });
    expect(progress.sentGroups).toBe(0);
    expect(progress.eligibleGroups).toBe(1);
    expect(progress.byArea).toEqual([]);
  });

  it("quebra os totais por área do grupo", () => {
    const progress = computeNpsOutreachProgress({
      eligibleCountByGroupId: { g1: 3, g2: 2, g3: 1 },
      sentGroupIds: ["g1", "g3"],
      respondedCountByGroupId: { g1: 1, g2: 2 },
      areaByGroupId: { g1: "Cível", g2: "Trabalhista", g3: "Cível" },
      groupNameById: { g1: "Grupo 1", g2: "Grupo 2", g3: "Grupo 3" },
    });
    expect(progress.eligiblePeople).toBe(6);
    expect(progress.eligibleGroups).toBe(3);
    expect(progress.sentGroups).toBe(2);
    expect(progress.respondedPeople).toBe(3);
    expect(progress.byArea).toEqual([
      {
        area: "Cível",
        eligiblePeople: 4,
        eligibleGroups: 2,
        sentGroups: 2,
        respondedPeople: 1,
        groups: [
          {
            id: "g1",
            name: "Grupo 1",
            eligiblePeople: 3,
            sent: true,
            respondedPeople: 1,
            senderUserId: null,
            senderName: NPS_OUTREACH_NO_SENDER,
            senderAvatarUrl: null,
          },
          {
            id: "g3",
            name: "Grupo 3",
            eligiblePeople: 1,
            sent: true,
            respondedPeople: 0,
            senderUserId: null,
            senderName: NPS_OUTREACH_NO_SENDER,
            senderAvatarUrl: null,
          },
        ],
      },
      {
        area: "Trabalhista",
        eligiblePeople: 2,
        eligibleGroups: 1,
        sentGroups: 0,
        respondedPeople: 2,
        groups: [
          {
            id: "g2",
            name: "Grupo 2",
            eligiblePeople: 2,
            sent: false,
            respondedPeople: 2,
            senderUserId: null,
            senderName: NPS_OUTREACH_NO_SENDER,
            senderAvatarUrl: null,
          },
        ],
      },
    ]);
  });

  it("coloca em Sem área só quem não tem área responsável", () => {
    const progress = computeNpsOutreachProgress({
      eligibleCountByGroupId: { g1: 2, g2: 1 },
      sentGroupIds: [],
      areaByGroupId: { g1: "Cível", g2: null },
      groupNameById: { g1: "Acme", g2: "Beta" },
    });
    expect(progress.byArea.map((row) => row.area)).toEqual(["Cível", NPS_OUTREACH_NO_AREA]);
    expect(progress.byArea.find((row) => row.area === NPS_OUTREACH_NO_AREA)?.groups).toEqual([
      {
        id: "g2",
        name: "Beta",
        eligiblePeople: 1,
        sent: false,
        respondedPeople: 0,
        senderUserId: null,
        senderName: NPS_OUTREACH_NO_SENDER,
        senderAvatarUrl: null,
      },
    ]);
  });
});

describe("resolveNpsCollectionArea", () => {
  it("usa a área responsável marcada", () => {
    expect(
      resolveNpsCollectionArea({
        responsibleArea: "Cível",
        involvedAreas: ["Trabalhista"],
        collectorDepartment: "Reestruturação",
      })
    ).toBe("Cível");
  });

  it("infere a única área envolvida quando não há responsável marcado", () => {
    expect(
      resolveNpsCollectionArea({
        responsibleArea: null,
        involvedAreas: ["Reestruturação", "Insolvência"],
      })
    ).toBe("Reestruturação");
  });

  it("usa a área de quem vai enviar quando não dá para inferir", () => {
    expect(
      resolveNpsCollectionArea({
        responsibleArea: null,
        involvedAreas: ["Cível", "Trabalhista"],
        collectorDepartment: "Reestruturação",
      })
    ).toBe("Reestruturação");
  });
});
