import { describe, expect, it } from "vitest";
import {
  aggregateNpsCampaignInsights,
  expectedInsightFieldCount,
  extractHeuristicThemes,
  isNpsKeepImprovingAsk,
  isNpsNotPainText,
  isNpsPraiseOnly,
  isNpsPracticeShare,
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

  it("não trata pedido real como elogio", () => {
    expect(isNpsPraiseOnly("Uma vez ao mês dizer como está indo o processo")).toBe(false);
    expect(isNpsPraiseOnly("disponibilidade restrita da equipe")).toBe(false);
    expect(isNpsPraiseOnly("abrir uma filial em Curitiba")).toBe(false);
    expect(isNpsPraiseOnly("reter talentos e reduzir o turnover")).toBe(false);
  });
});

describe("platitudes e relatos que não são dor", () => {
  it("trata melhoria contínua como platitude, não pedido", () => {
    expect(isNpsKeepImprovingAsk("Sempre adotar o conceito de melhoria contínua.")).toBe(true);
    expect(isNpsNotPainText("Sempre adotar o conceito de melhoria contínua.")).toBe(true);
    expect(isNpsNotPainText("Continuar com a dedicação e atenção de toda sua equipe")).toBe(true);
  });

  it("reconhece prática compartilhada de terceiro", () => {
    expect(
      isNpsPracticeShare(
        "Vou aproveitar para compartilhar uma prática que vi o pessoal de uma Legal AI brasileira apresentar num grupo recente"
      )
    ).toBe(true);
    expect(
      isNpsNotPainText(
        "o ponto crítico que fica claro quando a IA ajuda a redigir a peça final é a rastreabilidade"
      )
    ).toBe(true);
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

  it("não extrai tema de platitude de melhoria contínua", () => {
    expect(
      extractHeuristicThemes("Sempre adotar o conceito de melhoria contínua.", "improvement", 10)
    ).toEqual([]);
  });

  it("extrai comunicação e disponibilidade quando o texto pede e a nota é baixa", () => {
    const hits = extractHeuristicThemes(
      "Notamos iniciativas para otimizar a comunicação e a disponibilidade entre as partes, cuja continuidade será fundamental.",
      "improvement",
      9,
      { scoreAvailability: 6, scoreCommunication: 7 }
    );
    expect(hits.map((h) => h.id).sort()).toEqual(["comunicacao", "disponibilidade"]);
    expect(hits.every((h) => h.polarity === "pain")).toBe(true);
  });

  it("separa sobrecarga (dor) de competência técnica (não vai para Dores)", () => {
    const hits = extractHeuristicThemes(
      "Escritório capacitado, com competência técnica, mas sobrecarga de trabalho, com disponibilidade mais restrita de tempo. Comunicação de alto nível!",
      "improvement",
      9,
      { scoreAvailability: 7, scoreCommunication: 9 }
    );
    expect(hits.map((h) => h.id)).toEqual(["disponibilidade"]);
    expect(hits[0]?.polarity).toBe("pain");
  });

  it("manda relação de confiança para força, não para dor", () => {
    const hits = extractHeuristicThemes(
      "O estabelecimento de uma relação de confiança perene",
      "improvement",
      10,
      { scoreAvailability: 8, scoreCommunication: 8 }
    );
    expect(hits).toEqual([
      expect.objectContaining({ id: "relacionamento", polarity: "strength" }),
    ]);
  });

  it("não extrai tema de elogio no campo Melhoria", () => {
    expect(
      extractHeuristicThemes("Estou muito satisfeito. Parabéns a toda equipe.", "improvement", 10)
    ).toEqual([]);
    expect(extractHeuristicThemes("Relação perfeita", "improvement", 10)).toEqual([
      expect.objectContaining({ id: "relacionamento", polarity: "strength" }),
    ]);
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

  it("nota baixa de disponibilidade pesa 3 mesmo em Promotor", () => {
    expect(
      npsInsightMentionWeight({
        scoreRecommend: 9,
        field: "improvement",
        polarity: "pain",
        isNoise: false,
        themeId: "disponibilidade",
        scoreAvailability: 6,
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
          { id: "comunicacao", polarity: "pain", quote: "Uma vez ao mês dizer como está indo o processo" },
        ],
      }),
    ]);

    expect(insights.strengths.map((t) => t.id)).toEqual(
      expect.arrayContaining(["organizacao", "tecnica"])
    );
    expect(insights.pains.map((t) => t.id)).toContain("comunicacao");
    expect(insights.pains.find((t) => t.id === "comunicacao")?.maxWeight).toBe(2);
  });

  it("não coloca platitude, elogio nem prática compartilhada em Dores", () => {
    const insights = aggregateNpsCampaignInsights([
      row({
        field: "improvement",
        themes: [
          { id: "evolucao", polarity: "pain", quote: "Sempre adotar o conceito de melhoria contínua." },
          { id: "inovacao", polarity: "pain", quote: "Vou aproveitar para compartilhar uma prática que vi o pessoal de uma Legal AI" },
          { id: "tecnica", polarity: "pain", quote: "quando a IA ajuda a redigir a peça final é a rastreabilidade" },
          { id: "relacionamento", polarity: "pain", quote: "O estabelecimento de uma relação de confiança perene" },
        ],
      }),
      row({
        responseId: "pedido",
        field: "improvement",
        scoreAvailability: 6,
        scoreCommunication: 7,
        themes: [
          {
            id: "comunicacao",
            polarity: "pain",
            quote: "otimizar a comunicação e a disponibilidade entre as partes",
          },
          {
            id: "disponibilidade",
            polarity: "pain",
            quote: "otimizar a comunicação e a disponibilidade entre as partes",
          },
        ],
      }),
    ]);

    expect(insights.pains.map((t) => t.id).sort()).toEqual(["comunicacao", "disponibilidade"]);
    expect(insights.pains.find((t) => t.id === "evolucao")).toBeUndefined();
    expect(insights.pains.find((t) => t.id === "inovacao")).toBeUndefined();
    expect(insights.strengths.map((t) => t.id)).toContain("relacionamento");
  });

  it("ordena dores por intensidade: um Detrator acima de vários Promotores", () => {
    const promoterAsks: NpsInsightFieldRow[] = Array.from({ length: 5 }, (_, i) =>
      row({
        responseId: `p${i}`,
        clientGroupId: `g${i}`,
        groupName: `Grupo ${i}`,
        scoreRecommend: 10,
        field: "improvement",
        themes: [{ id: "comunicacao", polarity: "pain", quote: "Uma vez ao mês dizer como está indo o processo" }],
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
    expect(insights.pains[1]?.id).toBe("comunicacao");
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
