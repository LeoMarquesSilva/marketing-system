import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { montarPdfDaMemoria, nomeDoPdfDaMemoria, textoSeguro } from "./memoria-pdf";
import type { LinhaDaMemoria, MemoriaDoCalculo } from "./rec-credito";

const linha = (tipo: LinhaDaMemoria["tipo"], descricao: string, extra: Partial<LinhaDaMemoria> = {}): LinhaDaMemoria => ({
  tipo,
  descricao,
  data: "2022-05-12",
  valor: 1000,
  fatorCorrecao: 1.198526,
  corrigido: 1198.53,
  jurosPercentual: 0,
  juros: 0,
  total: 1198.53,
  sinal: 1,
  ...extra,
});

const memoria = (linhas: LinhaDaMemoria[]): MemoriaDoCalculo => ({
  ate: "2026-11-18",
  linhas,
  total: 12345.67,
  encargos: { honorarios: 10, multa: 10, origem: "padrão do cumprimento de sentença (CPC art. 523, §1º)" },
  avisos: [],
});

const processo = { cnj: "0000000-00.0000.8.26.0000", ci: "1", cliente: "EXEMPLO COMERCIO LTDA", devedor: "FULANO DE TAL" };

describe("PDF da memória do cálculo", () => {
  it("troca o que a fonte padrão não tem", () => {
    expect(textoSeguro("− R$ 1.000,00 ÷ §1º “x”")).toBe("- R$ 1.000,00 ÷ §1º “x”");
    expect(textoSeguro("a b ✓")).toBe("a b ");
  });

  it("gera um PDF que abre, com quebra de página quando a memória é longa", async () => {
    const curta = await PDFDocument.load(
      await montarPdfDaMemoria(
        memoria([
          linha("acao", "Valor da ação", { jurosPercentual: 48.5, juros: 581.29, total: 1779.82 }),
          linha("levantamento", "Levantamento: alvará", { sinal: -1 }),
          linha("multa", "Multa do art. 523", { percentual: 10 }),
          linha("guia", "Guia paga: Guia FEDTJ referente às pesquisas RENAJUD e INFOJUD com uma descrição bem comprida para quebrar"),
        ]),
        processo,
        "R$ 766,87"
      )
    );
    expect(curta.getPageCount()).toBe(1);
    const longa = await PDFDocument.load(await montarPdfDaMemoria(memoria(Array.from({ length: 80 }, (_, indice) => linha("guia", `Guia paga ${indice + 1}`))), processo, null));
    expect(longa.getPageCount()).toBeGreaterThan(1);
  });

  it("nomeia o arquivo pelo CNJ e pela data do cálculo", () => {
    expect(nomeDoPdfDaMemoria(processo, "2026-11-18")).toBe("memoria-calculo-0000000-00.0000.8.26.0000-2026-11-18.pdf");
    expect(nomeDoPdfDaMemoria({ ...processo, cnj: null }, "2026-11-18")).toBe("memoria-calculo-1-2026-11-18.pdf");
  });
});
