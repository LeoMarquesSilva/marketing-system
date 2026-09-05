import { describe, expect, it } from "vitest";
import { productionAction } from "./production";
import type { GustavoContentItem } from "./types";

const item = (overrides: Partial<GustavoContentItem>) => ({ status: "sugestao", ...overrides }) as GustavoContentItem;
describe("proxima acao na fila", () => {
  it("distingue escolha, opiniao e escrita por dados da pauta", () => {
    expect(productionAction(item({}))).toBe("choose");
    const selected_angle = { type: "diagnosis" as const, title: "Caixa", thesis: "Caixa", whyItMatters: "Caixa" };
    expect(productionAction(item({ selected_angle }))).toBe("answer");
    expect(productionAction(item({ selected_angle, opinion_status: "validated", gustavo_answers: ["Minha visão"] }))).toBe("edit");
    expect(productionAction(item({ linkedin_post: "Factual", opinion_status: "needs_gustavo" }))).toBe("edit");
  });
  it("mantem aprovacao, ajustes e acompanhamento em filas proprias", () => {
    expect(productionAction(item({ status: "rejeitado" }))).toBe("edit");
    expect(productionAction(item({ status: "aguardando_aprovacao", linkedin_post: "Texto" }))).toBe("approve");
    expect(productionAction(item({ status: "enviado_mkt" }))).toBe("publish");
    expect(productionAction(item({ status: "aprovado" }))).toBe("publish");
    expect(productionAction(item({ status: "publicado" }))).toBeNull();
  });
});
