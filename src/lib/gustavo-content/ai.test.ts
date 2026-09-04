import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const generateObject = vi.hoisted(() => vi.fn());
vi.mock("ai", () => ({ generateObject }));
import { generateEditorialContent } from "./ai";
import { contentObjectSchema } from "./schemas";
import { validateStrategyInput } from "./strategy";

const output = {
  editorialBrief: { centralThesis: "Preservar caixa", icp: "CEO", businessDecision: "Renegociar", supportingFacts: [], practicalConsequence: "Continuidade", limits: null },
  angleAlignment: { aligned: true, note: "" },
  linkedin: { hook: "Gancho", body: ["Desenvolvimento"], closing: null, hashtags: null },
  alternativeHooks: ["A", "B", "C"],
  reel: { duration: "60s", hook: "Caixa", talkingPoints: ["Liquidez"], closing: "Continuidade", recordingNote: "Natural" },
};
const input = {
  title: "Liquidez", snippet: "Empresa renegocia dividas", article: "", link: null,
  businessProblem: "Caixa", selectedAngle: null, thesisSnapshot: null, answers: null, questions: null,
  theses: [], voice: [], history: { similarityRisk: "low" as const, similarItems: [], reason: "", varyAngle: false },
  sourceContext: null, strategy: {
    ...validateStrategyInput({ positioning: "Reestruturacao", editorial_promise: "Clareza", strategic_rationale: "Decisoes", icp: ["CEO"] }),
    id: "main" as const, updated_by: null, created_at: "", updated_at: "",
  }, factualOnly: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_OPENAI_API_KEY", "test-key");
  generateObject.mockResolvedValue({ object: output });
});
afterEach(() => vi.unstubAllEnvs());

describe("contrato da geracao", () => {
  it("aceita a chave padrao OPENAI_API_KEY quando a chave legada nao existe", async () => {
    vi.stubEnv("NEXT_OPENAI_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "standard-test-key");
    expect((await generateEditorialContent(input)).linkedinPost).toBe("Gancho\n\nDesenvolvimento");
  });

  it("recusa gancho ou desenvolvimento vazio no contrato estruturado", () => {
    expect(contentObjectSchema.safeParse({ ...output, linkedin: { ...output.linkedin, hook: "   " } }).success).toBe(false);
    expect(contentObjectSchema.safeParse({ ...output, linkedin: { ...output.linkedin, body: [" "] } }).success).toBe(false);
  });

  it("encaminha o texto anterior para corrigir sem recriar a tese", async () => {
    await generateEditorialContent({ ...input, previousDraft: {
      linkedinPost: "Texto anterior a preservar", editorialBrief: output.editorialBrief, reel: output.reel,
    }, reviewFeedback: ["Rever gancho"] });
    expect(generateObject.mock.calls[0][0].prompt).toContain("Texto anterior a preservar");
  });

  it("limita a espera pela API e propaga cancelamento da operacao", async () => {
    const controller = new AbortController();
    await generateEditorialContent({ ...input, abortSignal: controller.signal });
    const signal = generateObject.mock.calls[0][0].abortSignal as AbortSignal;
    expect(signal).toBeInstanceOf(AbortSignal);
    controller.abort();
    expect(signal.aborted).toBe(true);
  });

  it("normaliza hashtags nos ganchos e em todos os campos do Reel", async () => {
    generateObject.mockResolvedValueOnce({ object: {
      ...output,
      alternativeHooks: ["CFOs e #Gestão", "#Caixa", "#Crédito"],
      reel: { duration: "60s", hook: "CFOs e #Gestão", talkingPoints: ["#Crédito"], closing: "#CAIXA", recordingNote: "Usar #Reestruturação" },
    } });
    const draft = await generateEditorialContent(input);
    expect(draft.alternativeHooks[0]).toBe("CFOs e #gestão");
    expect(draft.reel).toEqual({ duration: "60s", hook: "CFOs e #gestão", talkingPoints: ["#crédito"], closing: "#caixa", recordingNote: "Usar #reestruturação" });
  });

  it("remove travessoes de todos os textos entregues", async () => {
    generateObject.mockResolvedValueOnce({ object: {
      ...output,
      linkedin: { hook: "Caixa — decisão", body: ["Dívida – operação"], closing: "Ação — agora", hashtags: null },
      alternativeHooks: ["A — um", "B – dois", "C — três"],
      reel: { duration: "60s", hook: "Caixa — decisão", talkingPoints: ["Dívida – operação"], closing: "Ação — agora", recordingNote: "Tom — natural" },
    } });
    const draft = await generateEditorialContent(input);
    expect(JSON.stringify(draft)).not.toMatch(/[—–]/u);
  });

  it("usa parametros de raciocinio compativeis ao configurar GPT-5.6 para escrita", async () => {
    vi.stubEnv("GUSTAVO_CONTENT_MODEL_WRITING", "gpt-5.6-sol");
    vi.resetModules();
    const { generateEditorialContent: generateWithModel } = await import("./ai");
    await generateWithModel(input);
    const request = generateObject.mock.calls[0][0];
    expect(request.model.modelId).toBe("gpt-5.6-sol");
    expect(request.temperature).toBeUndefined();
    expect(request.providerOptions.openai.reasoningEffort).toBe("low");
    expect(request.maxOutputTokens).toBeGreaterThanOrEqual(6000);
  });
});
