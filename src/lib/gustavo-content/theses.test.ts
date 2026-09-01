import { describe, expect, it } from "vitest";
import {
  filterTheses,
  parseTagList,
  thesisSnapshot,
  validateThesisInput,
} from "@/lib/gustavo-content/theses";

const BASE = {
  id: "t1",
  title: "O processo não cria viabilidade",
  thesis:
    "Uma recuperação judicial pode criar proteção e tempo, mas não transforma uma empresa economicamente inviável em uma empresa viável.",
  explanation: null,
  business_importance: null,
  counterpoint: "Nem toda crise de caixa significa inviabilidade econômica.",
  applications: ["stay period", "recuperação judicial"],
  tags: ["reestruturação", "liquidez"],
  conviction: "strong" as const,
  status: "validated" as const,
  gustavo_phrases: ["O processo compra tempo. Não compra uma reestruturação."],
  usage_count: 2,
  last_used_at: "2026-08-01T00:00:00.000Z",
};

describe("parseTagList", () => {
  it("separa por vírgula e remove vazios", () => {
    expect(parseTagList("stay period, recuperação judicial,  ")).toEqual([
      "stay period",
      "recuperação judicial",
    ]);
  });
});

describe("validateThesisInput", () => {
  it("exige título e tese", () => {
    expect(() => validateThesisInput({ title: "  ", thesis: "texto" })).toThrow(
      /título/i
    );
    expect(() => validateThesisInput({ title: "Tese", thesis: "" })).toThrow(/tese/i);
  });

  it("rejeita status e convicção inválidos", () => {
    expect(() =>
      validateThesisInput({ title: "A", thesis: "B", status: "aprovada" })
    ).toThrow(/status/i);
    expect(() =>
      validateThesisInput({ title: "A", thesis: "B", conviction: "alta" })
    ).toThrow(/convic/i);
  });

  it("normaliza tags e frases", () => {
    const parsed = validateThesisInput({
      title: "  O processo não cria viabilidade ",
      thesis: "Proteção não é viabilidade.",
      tags: "RJ, liquidez, RJ",
      gustavo_phrases: ["O processo compra tempo.", ""],
    });
    expect(parsed.title).toBe("O processo não cria viabilidade");
    expect(parsed.tags).toEqual(["RJ", "liquidez"]);
    expect(parsed.gustavo_phrases).toEqual(["O processo compra tempo."]);
    expect(parsed.status).toBe("pending");
    expect(parsed.conviction).toBe("contextual");
  });
});

describe("filterTheses", () => {
  const pending = { ...BASE, id: "t2", status: "pending" as const, title: "Crédito caro" };
  const disabled = { ...BASE, id: "t3", status: "disabled" as const, tags: ["DIP"] };

  it("filtra por status, tag e busca", () => {
    const all = [BASE, pending, disabled];
    expect(filterTheses(all, { status: "validated" }).map((t) => t.id)).toEqual(["t1"]);
    expect(filterTheses(all, { tag: "DIP" }).map((t) => t.id)).toEqual(["t3"]);
    expect(filterTheses(all, { query: "crédito" }).map((t) => t.id)).toEqual(["t2"]);
  });
});

describe("thesisSnapshot", () => {
  it("preserva a tese no momento do uso", () => {
    expect(thesisSnapshot(BASE)).toContain("O processo não cria viabilidade");
    expect(thesisSnapshot(BASE)).toContain("não transforma");
  });
});
