import { describe, expect, it } from "vitest";
import {
  aggregateNpsCampaignInsights,
  expectedInsightFieldCount,
  extractHeuristicThemes,
  isNpsPraiseOnly,
  isNpsTextNoise,
  npsInsightMentionWeight,
  npsInsightProgress,
  type NpsInsightFieldRow,
} from "@/lib/nps/insights";

describe("isNpsTextNoise", () => {
  it("trata vazio e recusas curtas como ruído", () => {
    expect(isNpsTextNoise(null)).toBe(true);
    expect(isNpsTextNoise("  ")).toBe(true);
    expect(isNpsTextNoise("nada")).toBe(true);
    expect(isNpsTextNoise("Não.")).toBe(true);
    expect(isNpsTextNoise("n/a")).toBe(true);
    expect(isNpsTextNoise("nada a declarar")).toBe(true);
  });

  it("não trata melhoria contínua como ruído", () => {
    expect(
      isNpsTextNoise("Sempre adotar o conceito de melhoria contínua.")
    ).toBe(false);
    expect(isNpsTextNoise("continuar assim, evoluindo")).toBe(false);
  });
});

describe("isNpsPraiseOnly", () => {
  it("reconhece elogio no campo Melhoria", () => {
    expect(isNpsPraiseOnly("Estou muito satisfeito. Parabéns a toda equipe.")).toBe(true);
    expect(isNpsPraiseOnly("Relação perfeita")).toBe(true);
    expect(isNpsPraiseOnly("Estrutura ímpar e ótimo diálogo")).toBe(true);
    expect(isNpsPraiseOnly("Sempre tive excelente atendimento")).toBe(true);
    expect(isNpsPraiseOnly("parceria que vem crescendo ano a ano")).toBe(true);
  });

  it("não trata pedido real nem melhoria contínua como elogio", () => {
    expect(isNpsPraiseOnly("Sempre adotar o conceito de melhoria contínua.")).toBe(false);
    expect(isNpsPraiseOnly("Uma vez ao mês dizer como está indo o processo")).toBe(false);
    expect(isNpsPraiseOnly("disponibilidade restrita da equipe")).toBe(false);
    expect(isNpsPraiseOnly("abrir uma filial em Curitiba")).toBe(false);
    expect(isNpsPraiseOnly("reter talentos e reduzir o turnover")).toBe(false);
  });
});

describe("extractHeuristicThemes", () => {
  it("lê o motivo da Daniela", () => {
    const hits = extractHeuristicThemes(
      "Elevado nível técnico, agilidade no atendimento e nas providências jurídicas, engajamento e comprometimento da equipe e do sócio da área.",
      "reason",
      10
    );
    expect(hits.map((h) => h.id).sort()).toEqual(
      expect.arrayContaining(["tecnica", "agilidade", "engajamento_socio"])
    );
    expect(hits.every((h) => h.polarity === "strength")).toBe(true);
  });

  it("marca melhoria contínua no pedido do Nelson", () => {
    const hits = extractHeuristicThemes(
      "Sempre adotar o conceito de melhoria contínua.",
      "improvement",
      10
    );
    expect(hits.map((h) => h.id)).toContain("evolucao");
    expect(hits[0]?.polarity).toBe("pain");
  });

  it("não extrai tema de elogio no campo Melhoria", () => {
    expect(
      extractHeuristicThemes("Estou muito satisfeito. Parabéns a toda equipe.", "improvement", 10)
    ).toEqual([]);
    expect(extractHeuristicThemes("Relação perfeita", "improvement", 10)).toEqual([]);
  });
});

describe("npsInsightMentionWeight", () => {
  it("dá peso relevante ao pedido de Promotor", () => {
    expect(
      npsInsightMentionWeight({
        scoreRecommend: 10,
        field: "improvement",
        polarity: "pain",
        isNoise: false,
      })
    ).toBe(2);
  });

  it("Detrator pesa 3 na dor", () => {
    expect(
      npsInsightMentionWeight({
        scoreRecommend: 4,
        field: "reason",
        polarity: "pain",
        isNoise: false,
      })
    ).toBe(3);
  });
});

function row(partial: Partial<NpsInsightFieldRow> & Pick<NpsInsightFieldRow, "field" | "themes">): NpsInsightFieldRow {
  return {
    responseId: partial.responseId ?? "r1",
    clientGroupId: partial.clientGroupId ?? "g1",
    respondentName: partial.respondentName ?? "Cliente",
    groupName: partial.groupName ?? "Grupo A",
    scoreRecommend: partial.scoreRecommend ?? 10,
    isNoise: partial.isNoise ?? false,
    actionable: partial.actionable ?? false,
    ...partial,
  };
}

describe("aggregateNpsCampaignInsights", () => {
  it("separa forças do Motivo e pedidos da Melhoria", () => {
    const insights = aggregateNpsCampaignInsights([
      row({
        responseId: "nelson",
        field: "reason",
        themes: [
          { id: "organizacao", polarity: "strength", quote: "Organização e eficácia" },
          { id: "tecnica", polarity: "strength", quote: "conhecimento técnico" },
        ],
      }),
      row({
        responseId: "nelson",
        field: "improvement",
        themes: [
          { id: "evolucao", polarity: "pain", quote: "melhoria contínua" },
        ],
      }),
    ]);

    expect(insights.strengths.map((t) => t.id)).toEqual(
      expect.arrayContaining(["organizacao", "tecnica"])
    );
    expect(insights.pains.map((t) => t.id)).toContain("evolucao");
    expect(insights.pains.find((t) => t.id === "evolucao")?.maxWeight).toBe(2);
  });

  it("não coloca elogio da Melhoria em Dores, mesmo se veio classificado como dor", () => {
    const insights = aggregateNpsCampaignInsights([
      row({
        responseId: "elogio",
        field: "improvement",
        themes: [
          { id: "evolucao", polarity: "pain", quote: "Estou muito satisfeito. Parabéns a toda equipe." },
          { id: "relacionamento", polarity: "pain", quote: "Relação perfeita" },
        ],
      }),
      row({
        responseId: "pedido",
        field: "improvement",
        themes: [{ id: "comunicacao", polarity: "pain", quote: "Uma vez ao mês dizer como está indo o processo" }],
      }),
    ]);

    expect(insights.pains.map((t) => t.id)).toEqual(["comunicacao"]);
    expect(insights.pains.find((t) => t.id === "evolucao")).toBeUndefined();
    expect(insights.pains.find((t) => t.id === "relacionamento")).toBeUndefined();
  });

  it("ordena dores por intensidade: um Detrator acima de vários Promotores", () => {
    const promoterAsks: NpsInsightFieldRow[] = Array.from({ length: 5 }, (_, i) =>
      row({
        responseId: `p${i}`,
        clientGroupId: `g${i}`,
        groupName: `Grupo ${i}`,
        scoreRecommend: 10,
        field: "improvement",
        themes: [{ id: "evolucao", polarity: "pain", quote: "melhoria contínua" }],
      })
    );
    const detractor = row({
      responseId: "det",
      clientGroupId: "g-det",
      groupName: "Grupo Detrator",
      scoreRecommend: 4,
      field: "reason",
      themes: [{ id: "agilidade", polarity: "pain", quote: "prazos estourando" }],
    });

    const insights = aggregateNpsCampaignInsights([...promoterAsks, detractor]);
    expect(insights.pains[0]?.id).toBe("agilidade");
    expect(insights.pains[0]?.maxWeight).toBe(3);
    expect(insights.pains[1]?.id).toBe("evolucao");
  });

  it("conta campos pendentes só quando há texto", () => {
    expect(expectedInsightFieldCount(null, null)).toBe(0);
    expect(expectedInsightFieldCount("nada", null)).toBe(0);
    expect(expectedInsightFieldCount("Ótimo técnico", "nada")).toBe(1);
    expect(expectedInsightFieldCount("Ótimo técnico", "melhoria contínua")).toBe(2);
  });

  it("progresso da barra usa classificados / esperado", () => {
    const insights = aggregateNpsCampaignInsights(
      [
        row({
          field: "reason",
          themes: [{ id: "tecnica", polarity: "strength", quote: "nível técnico" }],
        }),
      ],
      3
    );
    expect(npsInsightProgress(insights)).toEqual({ done: 1, total: 4, pct: 25 });
  });
});
