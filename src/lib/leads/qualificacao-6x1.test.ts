import { describe, expect, it } from "vitest";
import { classificarLead, PERGUNTAS_6X1, validarRespostas } from "./qualificacao-6x1";

const base = { exposicao: "parte", porte: "51-200", estagio: "levantando", prazo: "ate-dez-2026", contato: "depois" };

describe("classificarLead", () => {
  it("pedido de contato de empresa afetada é quente, mesmo com pontuação baixa", () => {
    const r = classificarLead({ exposicao: "parte", porte: "ate-50", estagio: "concluida", prazo: "nao-sei", contato: "sim" });
    expect(r.temperatura).toBe("quente");
  });

  it("empresa sem 6x1 nem jornada acima de 40 h é fria", () => {
    expect(classificarLead({ ...base, exposicao: "nao", contato: "nao" }).temperatura).toBe("frio");
  });

  it("empresa sem 6x1 que pede contato fica morna (vale ouvir, mas não é o produto)", () => {
    expect(classificarLead({ ...base, exposicao: "nao", contato: "sim" }).temperatura).toBe("morno");
  });

  it("soma alta sem pedido de contato é quente", () => {
    const r = classificarLead({ exposicao: "maioria", porte: "mais-200", estagio: "nao-comecou", prazo: "ate-dez-2026", contato: "depois" });
    expect(r.pontos).toBe(12);
    expect(r.temperatura).toBe("quente");
  });

  it("soma no meio é morna e soma baixa é fria", () => {
    expect(classificarLead(base).pontos).toBe(9);
    expect(classificarLead(base).temperatura).toBe("morno");
    const baixo = classificarLead({ exposicao: "parte", porte: "ate-50", estagio: "concluida", prazo: "nao-sei", contato: "nao" });
    expect(baixo.pontos).toBe(3);
    expect(baixo.temperatura).toBe("frio");
  });
});

describe("validarRespostas", () => {
  it("exige todas as perguntas com opção válida", () => {
    expect(validarRespostas(base)).toBeNull();
    expect(validarRespostas({ ...base, prazo: "" })).toContain("Responda");
    expect(validarRespostas({ ...base, porte: "mil" })).toContain("inválida");
  });

  it("tem de 3 a 5 perguntas, como pedido à área", () => {
    expect(PERGUNTAS_6X1.length).toBeGreaterThanOrEqual(3);
    expect(PERGUNTAS_6X1.length).toBeLessThanOrEqual(5);
  });
});
