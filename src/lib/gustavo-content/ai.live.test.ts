import { expect, it } from "vitest";

// Opt-in: usa a API real apenas quando solicitado explicitamente no comando de teste.
it.skipIf(process.env.GUSTAVO_AI_SMOKE !== "1")("gera e revisa uma pauta ficticia com a API configurada", async () => {
  const { config } = await import("dotenv");
  config({ path: [".env.local", ".env"], quiet: true });
  const ai = await import("./ai");
  const { validateStrategyInput } = await import("./strategy");
  const strategy = {
    ...validateStrategyInput({
      positioning: "Analise de reestruturacao empresarial para executivos",
      editorial_promise: "Explicar decisoes empresariais com clareza",
      strategic_rationale: "Ajudar o publico a entender liquidez, divida e continuidade",
      icp: ["CEOs", "CFOs"],
    }), id: "main" as const, created_at: "", updated_at: "", updated_by: null,
  };
  try {
    const source = {
      title: "Cenario ficticio: alongar a divida sem corrigir o caixa",
      snippet: "Exemplo inteiramente ficticio para teste, sem empresa ou pessoas reais.",
      article: "Uma empresa ficticia renegocia os vencimentos, mas mantem um deficit operacional. O alongamento reduz a pressao imediata e nao corrige a geracao de caixa. Nao ha dados numericos nem resultados confirmados.",
      link: null, theses: [], strategy,
    };
    const score = await ai.analyzeScore(source);
    const angles = await ai.generateAngles(source);
    const draft = await ai.generateEditorialContent({
      ...source, businessProblem: score.businessProblem, selectedAngle: angles.angles[0],
      thesisSnapshot: null, answers: null, questions: angles.questions, voice: [],
      history: { similarityRisk: "low", similarItems: [], reason: "Sem historico", varyAngle: false },
      sourceContext: score.sourceContext, factualOnly: true,
    });
    const review = await ai.reviewEditorialContent({ linkedinPost: draft.linkedinPost, centralThesis: draft.editorialBrief.centralThesis });
    const compliance = await ai.analyzeCompliance({ linkedinPost: draft.linkedinPost, reelScript: JSON.stringify(draft.reel) });
    expect(draft.linkedinPost.split("\n\n").length).toBeGreaterThan(1);
    expect(draft.alternativeHooks).toHaveLength(3);
    expect(draft.reel.talkingPoints.length).toBeGreaterThan(0);
    console.info("[gustavo-smoke]", JSON.stringify({ score: score.total, angles: angles.angles.length, characters: draft.linkedinPost.length, editorialReview: review, compliance }));
  } catch (error) {
    // Erros do SDK podem conter request/response; nao imprimir credenciais ou payloads.
    const info = error as { name?: string; statusCode?: number; finishReason?: string };
    throw new Error(`Smoke falhou: ${info.name ?? "Error"}, HTTP ${info.statusCode ?? "n/a"}, finishReason ${info.finishReason ?? "n/a"}`);
  }
}, 120_000);
