import { describe, expect, it } from "vitest";
import { NAV_FRONTS } from "@/lib/navigation";
import { ABAS_COM_CONTAGEM, abaDoHref, lerContagens } from "./contagens";

describe("contagens das abas da Vistagem", () => {
  const abas = NAV_FRONTS.flatMap((frente) => frente.features).find((funcionalidade) => funcionalidade.id === "vistagem")?.pages ?? [];

  it("cada contagem aponta para uma aba do cabeçalho", () => {
    const hrefs = abas.map((aba) => aba.href);
    for (const { href } of Object.values(ABAS_COM_CONTAGEM)) expect(hrefs).toContain(href);
  });

  it("Visão geral e Gestão das publicações ficam sem número", () => {
    expect(abaDoHref("/operacoes-legais/vistagem")).toBeNull();
    expect(abaDoHref("/operacoes-legais/vistagem/base")).toBeNull();
    expect(abaDoHref("/operacoes-legais/vistagem/juridico")).toBe("vistagem");
    expect(abaDoHref("/operacoes-legais/vistagem/check")).toBe("check");
  });

  it("frase no singular e no plural", () => {
    expect(ABAS_COM_CONTAGEM.vistagem.descrever(1)).toBe("1 publicação para vistar");
    expect(ABAS_COM_CONTAGEM.duplicidades.descrever(3)).toBe("3 duplicidades a revisar");
  });

  it("resposta estranha vira zero", () => {
    expect(lerContagens({ triagem: "4", duplicidades: -2, vistagem: null, conferencia: 7.9, check: "x" })).toEqual({
      triagem: 4,
      duplicidades: 0,
      vistagem: 0,
      conferencia: 7,
      check: 0,
    });
    expect(lerContagens(null)).toEqual({ triagem: 0, duplicidades: 0, vistagem: 0, conferencia: 0, check: 0 });
  });
});
