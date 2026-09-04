import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GustavoContentItem } from "./types";

const mocks = vi.hoisted(() => ({
  admin: vi.fn(), score: vi.fn(), angles: vi.fn(), write: vi.fn(), review: vi.fn(),
  compliance: vi.fn(), theses: vi.fn(),
}));
vi.mock("./server", async () => ({
  ...(await import("./errors")), getGustavoContentAdmin: mocks.admin,
}));
vi.mock("./ai", () => ({
  analyzeScore: mocks.score, generateAngles: mocks.angles,
  generateEditorialContent: mocks.write, reviewEditorialContent: mocks.review,
  analyzeCompliance: mocks.compliance,
}));
vi.mock("./theses-server", () => ({ listTheses: mocks.theses }));
vi.mock("./voice-server", () => ({ listActiveVoice: async () => [] }));
vi.mock("./strategy-server", () => ({ getStrategy: async () => ({}) }));

import {
  analyzeItem, generateItemContent, saveItemAnswers, saveItemEdits,
  selectAngle, submitToGustavo, markPublished,
} from "./items";

const angle = { type: "diagnosis" as const, title: "Caixa", thesis: "Preservar caixa", whyItMatters: "Continuidade" };
const actor = { id: "editor", authId: "editor-auth", name: "Editor", email: null, role: "admin", isAdmin: true, memberRole: null };
let row: GustavoContentItem;
let revision: number;

beforeEach(() => {
  vi.clearAllMocks();
  revision = 0;
  row = {
    id: "item-1", source: "manual_idea", status: "radar", title: "Liquidez empresarial",
    topic_id: null, thesis_id: null, thesis_snapshot: null, source_context: null,
    content_snippet: "Empresa precisa preservar caixa antes de renegociar dividas.", link: null,
    selected_angle: angle, angles: [angle], opinion_status: "needs_gustavo",
    gustavo_answers: null, gustavo_questions: ["Qual a prioridade?"],
    linkedin_post: null, reel_script: null, original_linkedin_post: null, original_reel_script: null,
    has_alterations: false, created_at: "2026-09-01T00:00:00Z", updated_at: "revision-0",
  } as GustavoContentItem;
  // Simula somente a fronteira do banco; filtros e atualizacoes afetam a linha em memoria.
  mocks.admin.mockReturnValue({ from: () => {
    let patch: Record<string, unknown> | undefined;
    let matches = true;
    const query = {
      select: () => query, order: () => query, gte: () => query, in: () => query,
      neq: () => query,
      eq: (key: keyof GustavoContentItem, value: unknown) => { matches &&= row[key] === value; return query; },
      update: (value: Record<string, unknown>) => { patch = value; return query; },
      maybeSingle: async () => {
        if (!matches) return { data: null, error: null };
        if (patch) row = { ...row, ...patch, updated_at: `revision-${++revision}` };
        return { data: { ...row }, error: null };
      },
      then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve),
    };
    return query;
  } });
  mocks.theses.mockResolvedValue([]);
  mocks.score.mockResolvedValue({ total: 60, breakdown: {}, reason: "Relevante", businessProblem: "Caixa", sourceContext: { facts: [], numbers: [], companies: [], dates: [], sourceUrls: [] } });
  mocks.angles.mockResolvedValue({ angles: [angle], thesisMatch: { thesisId: null, confidence: "none", reason: "Sem tese" }, questions: ["Nova pergunta?"] });
  mocks.write.mockResolvedValue({
    linkedinPost: "Novo gancho\n\nDesenvolvimento factual.", alternativeHooks: ["A", "B", "C"],
    reel: { duration: "60s", hook: "Caixa", talkingPoints: ["Liquidez"], closing: "Continuidade", recordingNote: "Natural" },
    editorialBrief: { centralThesis: "Preservar caixa", icp: "CEO", businessDecision: "Renegociar", supportingFacts: [], practicalConsequence: "Continuidade" },
    angleAlignment: { aligned: true, note: "" },
  });
  mocks.review.mockResolvedValue({ passesReview: true, issues: [], notes: "" });
  mocks.compliance.mockResolvedValue({ safe: true, flags: [], requiresHumanReview: false, notes: [] });
});

describe("fluxo de geracao Gustavo", () => {
  it("move a pauta do radar para rascunho depois de gerar", async () => {
    expect((await generateItemContent(row.id, { mode: "factual" })).status).toBe("rascunho");
  });

  it("gera leituras para uma pauta do radar aberta para analise manual", async () => {
    row.angles = null;
    row.selected_angle = null;
    expect((await analyzeItem(row.id)).angles).toEqual([angle]);
  });

  it("reanalise preserva escolha, perguntas e opiniao ja fornecida", async () => {
    row.status = "rascunho";
    row.opinion_status = "validated";
    row.gustavo_answers = ["Priorizar caixa operacional"];
    mocks.score.mockResolvedValueOnce({ ...await mocks.score(), total: 80 });
    const updated = await analyzeItem(row.id);
    expect(updated).toMatchObject({ status: "rascunho", selected_angle: angle, opinion_status: "validated", gustavo_questions: ["Qual a prioridade?"] });
  });

  it.each(["aprovado", "enviado_mkt", "publicado", "arquivado"] as const)("protege texto, respostas e leitura em %s", async (status) => {
    row.status = status;
    await expect(saveItemEdits(row.id, { linkedin_post: "Alterado" }, actor)).rejects.toMatchObject({ status: 409 });
    await expect(saveItemAnswers(row.id, ["Nova opiniao"], actor)).rejects.toMatchObject({ status: 409 });
    await expect(selectAngle(row.id, 0)).rejects.toMatchObject({ status: 409 });
    expect(row.linkedin_post).toBeNull();
  });

  it("editar texto aguardando aprovacao exige nova submissao", async () => {
    row.status = "aguardando_aprovacao";
    row.linkedin_post = "Original";
    row.submitted_to_gustavo_at = "2026-09-01T00:00:00Z";
    const updated = await saveItemEdits(row.id, { linkedin_post: "Corrigido" }, actor);
    expect(updated).toMatchObject({ status: "rascunho", compliance_flags: null, submitted_to_gustavo_at: null });
  });

  it("permite corrigir e regenerar uma pauta rejeitada", async () => {
    row.status = "rejeitado";
    row.rejection_reason = "Rever gancho";
    const updated = await generateItemContent(row.id, { mode: "factual" });
    expect(updated).toMatchObject({ status: "rascunho", rejection_reason: null });
  });

  it("nao sobrescreve uma edicao feita enquanto a IA gerava", async () => {
    mocks.write.mockImplementationOnce(async () => {
      row = { ...row, linkedin_post: "Edicao de outra pessoa", updated_at: "revision-external" };
      return { ...await mocks.write() };
    });
    await expect(generateItemContent(row.id, { mode: "factual" })).rejects.toMatchObject({ status: 409 });
    expect(row.linkedin_post).toBe("Edicao de outra pessoa");
  });

  it("preserva o rascunho se revisao ou compliance falharem", async () => {
    mocks.review.mockRejectedValue(new Error("Timeout"));
    mocks.compliance.mockRejectedValue(new Error("Timeout"));
    const updated = await generateItemContent(row.id, { mode: "factual" });
    expect(updated.linkedin_post).toContain("Novo gancho");
    expect(updated.compliance_flags).toBeNull();
  });

  it("envia o primeiro texto e a tese para a revisao corretiva", async () => {
    mocks.review.mockResolvedValueOnce({ passesReview: false, issues: ["Gancho generico"], notes: "" });
    await generateItemContent(row.id, { mode: "factual" });
    expect(mocks.write.mock.calls[1][0]).toMatchObject({
      previousDraft: { linkedinPost: "Novo gancho\n\nDesenvolvimento factual.", editorialBrief: { centralThesis: "Preservar caixa" } },
    });
  });

  it("nao aceita nota automatica de pular como opiniao do Gustavo", async () => {
    const { SKIPPED_VISION_NOTE } = await import("./answers");
    await expect(saveItemAnswers(row.id, [SKIPPED_VISION_NOTE], actor)).rejects.toMatchObject({ status: 400 });
  });

  it("nao usa validacao legada sem respostas reais nem tese ativa validada", async () => {
    row.opinion_status = "validated";
    const { SKIPPED_VISION_NOTE } = await import("./answers");
    row.gustavo_answers = [SKIPPED_VISION_NOTE];
    await expect(generateItemContent(row.id)).rejects.toMatchObject({ status: 409 });
  });

  it("usa respostas reais como base para gerar opiniao", async () => {
    row.opinion_status = "validated";
    row.gustavo_answers = ["Priorizar a geracao de caixa antes da renegociacao"];
    expect((await generateItemContent(row.id)).status).toBe("rascunho");
  });

  it("rejeita segunda geracao simultanea antes de chamar a API novamente", async () => {
    let finish!: (value: unknown) => void;
    const draft = await mocks.write();
    mocks.write.mockClear();
    mocks.write.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const first = generateItemContent(row.id, { mode: "factual" });
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    const second = generateItemContent(row.id, { mode: "factual" });
    const check = expect(second).rejects.toMatchObject({ status: 409 });
    finish(draft);
    await first;
    await check;
    expect(mocks.write).toHaveBeenCalledTimes(1);
  });

  it("recusa URL de publicacao invalida", async () => {
    row.status = "aprovado";
    await expect(markPublished(row.id, { linkedin_published_url: "javascript:alert(1)" })).rejects.toMatchObject({ status: 400 });
  });

  it("nao envia para aprovacao uma versao alterada durante compliance", async () => {
    row.status = "rascunho";
    row.linkedin_post = "Texto revisado";
    mocks.compliance.mockImplementationOnce(async () => {
      row = { ...row, linkedin_post: "Outra versao", updated_at: "revision-external" };
      return { safe: true, flags: [], requiresHumanReview: false, notes: [] };
    });
    await expect(submitToGustavo(row.id)).rejects.toMatchObject({ status: 409 });
    expect(row.status).toBe("rascunho");
  });

  it("impede registrar publicacao antes da aprovacao", async () => {
    await expect(markPublished(row.id, { linkedin_published_url: "https://linkedin.com/posts/test" })).rejects.toMatchObject({ status: 409 });
  });
});
