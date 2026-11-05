import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MODULOS_GUIA, ehModuloGuia, guiasVistos, moduloDaRota } from "./guia";
import { PASSOS_GUIA, TITULO_GUIA } from "./guia-passos";

/** Texto de todos os componentes da Vistagem, para conferir que cada alvo do guia está marcado na tela. */
function componentesDaVistagem(): string {
  const pasta = join(process.cwd(), "src", "components", "operacoes-legais", "vistagem");
  return readdirSync(pasta)
    .filter((arquivo) => arquivo.endsWith(".tsx"))
    .map((arquivo) => readFileSync(join(pasta, arquivo), "utf8"))
    .join("\n");
}

describe("moduloDaRota", () => {
  it("cada aba da Vistagem tem o seu guia", () => {
    expect(moduloDaRota("/operacoes-legais/vistagem")).toBe("visao-geral");
    expect(moduloDaRota("/operacoes-legais/vistagem/")).toBe("visao-geral");
    expect(moduloDaRota("/operacoes-legais/vistagem/base")).toBe("gestao");
    expect(moduloDaRota("/operacoes-legais/vistagem/controladoria")).toBe("triagem");
    expect(moduloDaRota("/operacoes-legais/vistagem/duplicidades")).toBe("duplicidades");
    expect(moduloDaRota("/operacoes-legais/vistagem/juridico")).toBe("vistagem");
    expect(moduloDaRota("/operacoes-legais/vistagem/conferencia")).toBe("conferencia");
    expect(moduloDaRota("/operacoes-legais/vistagem/check")).toBe("check");
    expect(moduloDaRota("/operacoes-legais/vistagem/configuracoes")).toBe("configuracoes");
  });

  it("fora da Vistagem não há guia", () => {
    expect(moduloDaRota("/operacoes-legais")).toBeNull();
    expect(moduloDaRota("/operacoes-legais/vistagemx")).toBeNull();
    expect(moduloDaRota("/operacoes-legais/vistagem/outra")).toBeNull();
    expect(moduloDaRota(null)).toBeNull();
  });
});

describe("guiasVistos", () => {
  it("soma o banco e o navegador, ignorando abas e datas inválidas", () => {
    expect(guiasVistos({ vistagem: "2026-11-05T10:00:00Z", x: "2026-11-05" }, { check: "2026-11-04T10:00:00Z", conferencia: 3 }, null)).toEqual({
      vistagem: "2026-11-05T10:00:00Z",
      check: "2026-11-04T10:00:00Z",
    });
  });

  it("a primeira fonte vale quando as duas têm a aba", () => {
    expect(guiasVistos({ check: "a" }, { check: "b" })).toEqual({ check: "a" });
  });

  it("ehModuloGuia só aceita as abas da Vistagem", () => {
    expect(ehModuloGuia("triagem")).toBe(true);
    expect(ehModuloGuia("juridico")).toBe(false);
  });
});

describe("passos do guia", () => {
  it("toda aba tem título, passos com id único e um último passo de resumo sem alvo", () => {
    for (const modulo of MODULOS_GUIA) {
      const passos = PASSOS_GUIA[modulo];
      expect(TITULO_GUIA[modulo]).toBeTruthy();
      expect(passos.length).toBeGreaterThanOrEqual(3);
      expect(new Set(passos.map((passo) => passo.id)).size).toBe(passos.length);
      expect(passos.at(-1)?.alvo).toBeNull();
      for (const passo of passos) {
        expect(passo.titulo.length).toBeGreaterThan(3);
        expect(passo.texto.length).toBeGreaterThan(30);
      }
    }
  });

  it("todo alvo e alternativa está marcado com data-tour (ou tour=) em algum componente da Vistagem", () => {
    const telas = componentesDaVistagem();
    const faltando = MODULOS_GUIA.flatMap((modulo) =>
      PASSOS_GUIA[modulo].flatMap((passo) => [passo.alvo, passo.alternativa]).filter((alvo): alvo is string => Boolean(alvo))
    ).filter((alvo) => !telas.includes(`"${alvo}"`));
    expect(faltando).toEqual([]);
  });
});
