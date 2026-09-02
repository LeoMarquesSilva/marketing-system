import { describe, expect, it } from "vitest";
import { nextStepText } from "@/components/gustavo-content/item-workspace";
import type { GustavoContentItem } from "@/lib/gustavo-content/types";

function baseItem(overrides: Partial<GustavoContentItem> = {}): GustavoContentItem {
  return {
    id: "item-1",
    source: "manual_idea",
    topic_id: null,
    title: "Pauta de teste",
    link: null,
    content_snippet: null,
    published_at: null,
    image_url: null,
    source_context: null,
    editorial_score: 80,
    score_breakdown: null,
    score_reason: null,
    business_problem: null,
    angles: [
      { type: "diagnosis", title: "Diagnóstico", thesis: "...", whyItMatters: "..." },
      { type: "strategy", title: "Estratégia", thesis: "...", whyItMatters: "..." },
      { type: "opinion", title: "Contraponto", thesis: "...", whyItMatters: "..." },
    ],
    selected_angle: null,
    thesis_id: null,
    thesis_snapshot: null,
    opinion_status: "needs_gustavo",
    gustavo_questions: [],
    gustavo_answers: null,
    recommended_channels: null,
    linkedin_post: null,
    original_linkedin_post: null,
    reel_script: null,
    original_reel_script: null,
    alternative_hooks: null,
    compliance_flags: null,
    factual_flags: null,
    status: "sugestao",
    rejection_reason: null,
    has_alterations: false,
    created_by: null,
    created_by_name: null,
    edited_by: null,
    edited_by_name: null,
    edited_at: null,
    submitted_to_gustavo_at: null,
    approved_by: null,
    approved_at: null,
    approval_kind: null,
    marketing_request_linkedin_id: null,
    marketing_request_reel_id: null,
    linkedin_published_url: null,
    instagram_published_url: null,
    linkedin_published_at: null,
    instagram_published_at: null,
    performance: null,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("nextStepText", () => {
  it("pede uma leitura quando há ângulos mas nenhum foi escolhido", () => {
    const item = baseItem({ selected_angle: null });
    expect(nextStepText(item, false, null)).toBe(
      "Selecione uma leitura para liberar a próxima ação."
    );
  });

  it("nunca fica sem próximo passo: ângulo escolhido sem opinião e sem perguntas ainda orienta a factual", () => {
    const item = baseItem({
      selected_angle: { type: "diagnosis", title: "Diagnóstico", thesis: "...", whyItMatters: "..." },
      opinion_status: "needs_gustavo",
      gustavo_questions: [],
    });
    expect(nextStepText(item, false, null)).toBe(
      "Registre a visão do Gustavo ou peça a análise factual para liberar a redação."
    );
  });

  it("com opinião validada e ângulo escolhido, indica que o rascunho será gerado", () => {
    const item = baseItem({
      selected_angle: { type: "diagnosis", title: "Diagnóstico", thesis: "...", whyItMatters: "..." },
      opinion_status: "validated",
    });
    expect(nextStepText(item, false, null)).toBe("Visão registrada. Agora geramos o rascunho.");
  });

  it("edições não salvas sempre têm prioridade sobre o restante do fluxo", () => {
    const item = baseItem({
      selected_angle: { type: "diagnosis", title: "Diagnóstico", thesis: "...", whyItMatters: "..." },
      opinion_status: "validated",
      linkedin_post: "Gancho\n\nCorpo",
      status: "rascunho",
    });
    expect(nextStepText(item, true, null)).toBe(
      "Salve as alterações para preservar a trilha de edição."
    );
  });

  it("busy tem prioridade sobre o texto de status", () => {
    const item = baseItem();
    expect(nextStepText(item, false, "generate")).toBe(
      "Gerando LinkedIn e Reel. Isso pode levar até um minuto."
    );
  });
});
