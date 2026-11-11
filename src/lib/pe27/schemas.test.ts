import { describe, expect, it } from "vitest";
import { goalCreateSchema, goalPatchSchema, leverPatchSchema } from "./schemas";

// Ids reais das alavancas do workshop (gerados por md5 na migration): o zod 4 recusava com "Invalid UUID".
const ALAVANCA_CRESCIMENTO = "a1ba7343-03aa-c077-dd7d-6c08ce1a2098";
const ALAVANCA_ATENDIMENTO = "1ba0f26c-c635-10f0-1fb8-ee5865d2b85b";

describe("validação das edições do PE27", () => {
  it("aceita salvar a meta com a alavanca do workshop e campos preenchidos aos poucos", () => {
    // O mesmo corpo que o modal envia ao clicar em Editar e Salvar.
    const parsed = goalPatchSchema.safeParse({
      status: "em_analise",
      merged_into: null,
      decision_note: "Unidade de Medida: R$.",
      text: "Receita Bruta",
      lever_id: ALAVANCA_CRESCIMENTO,
      baseline: "",
      target: "",
      data_source: "",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.lever_id).toBe(ALAVANCA_CRESCIMENTO);
    // Vazio vira null: nada é obrigatório além do texto da meta.
    expect(parsed.data.baseline).toBeNull();
    expect(parsed.data.target).toBeNull();
    expect(parsed.data.data_source).toBeNull();
  });

  it("aceita juntar e criar meta com ids do workshop", () => {
    expect(leverPatchSchema.safeParse({ status: "juntada", merged_into: ALAVANCA_ATENDIMENTO }).success).toBe(true);
    expect(goalCreateSchema.safeParse({ lever_id: ALAVANCA_ATENDIMENTO, text: "NPS acima de 75" }).success).toBe(true);
  });

  it("recusa id fora do formato com mensagem em português", () => {
    const parsed = goalCreateSchema.safeParse({ lever_id: "abc", text: "x" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0]?.message).toBe("Identificador inválido.");
  });
});
