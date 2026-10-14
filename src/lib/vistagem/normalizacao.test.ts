import { describe, expect, it } from "vitest";
import { normalizarProcesso } from "./processo";
import { normalizarTribunal } from "./tribunal";
import { lerNomeArquivoKurier } from "./kurier-arquivo";

describe("normalizarProcesso", () => {
  it("mantém o CNJ com máscara", () => {
    expect(normalizarProcesso("0001234-56.2024.8.26.0100")).toEqual({
      cnj: "0001234-56.2024.8.26.0100",
      digitos: "00012345620248260100",
      sufixo: null,
    });
  });

  it("aplica a máscara em CNJ sem pontuação", () => {
    expect(normalizarProcesso("00012345620248260100").cnj).toBe("0001234-56.2024.8.26.0100");
  });

  it("separa o sufixo de incidente do TJSP", () => {
    expect(normalizarProcesso("2000001-11.2026.8.26.0000/50000")).toMatchObject({
      cnj: "2000001-11.2026.8.26.0000",
      sufixo: "50000",
    });
  });

  it("busca o CNJ no teor quando a Kurier marca número fora do padrão", () => {
    const teor = "PROCESSO:0007654-32.2025.5.15.0001 ORGÃO:1ª Vara";
    expect(normalizarProcesso("Número fora do Padrão", teor).cnj).toBe("0007654-32.2025.5.15.0001");
  });

  it("devolve vazio quando não há CNJ", () => {
    expect(normalizarProcesso("Número fora do Padrão", "sem número")).toEqual({ cnj: null, digitos: null, sufixo: null });
  });
});

describe("normalizarTribunal", () => {
  it.each([
    ["TJSP_DJEN_ESTADUAL", "TJSP", "estadual"],
    ["TRT 15_DJEN_TRABALHISTA", "TRT15", "trabalhista"],
    ["TST_DJEN_SUPERIOR", "TST", "trabalhista"],
    ["STJ_DJEN_SUPERIOR", "STJ", "superior"],
    ["TRF 3_DJEN_FEDERAL", "TRF3", "federal"],
    ["TJDFT_DJEN_DISTRITAL", "TJDFT", "estadual"],
    ["TRT - 2 REGIAO _TRT2", "TRT2", "trabalhista"],
    ["DJSP_TRT15_Trabalhista", "TRT15", "trabalhista"],
    ["DJES_TRT_Trabalhista", "TRT17", "trabalhista"],
    ["DJPR_Trabalhista", "TRT9", "trabalhista"],
    ["DJMG_Judiciário", "TJMG", "estadual"],
    ["DJSP_Caderno 3", "TJSP", "estadual"],
    ["DJPE_PJE_INTIMACOES_2GRAU", "TJPE", "estadual"],
    ["TJDF_Tribunal", "TJDFT", "estadual"],
    ["STJ_STJ", "STJ", "superior"],
  ])("%s → %s", (diario, sigla, justica) => {
    expect(normalizarTribunal(diario)).toEqual({ sigla, justica });
  });

  it("devolve o texto original quando não reconhece o diário", () => {
    expect(normalizarTribunal("Diário Novo")).toEqual({ sigla: "Diário Novo", justica: null });
  });
});

describe("lerNomeArquivoKurier", () => {
  it("lê lote e data do nome do arquivo", () => {
    expect(lerNomeArquivoKurier("escritorio.adv2_Lote-01_14102026.xlsx")).toEqual({ lote: 1, dataArquivo: "2026-10-14" });
  });

  it("recusa nomes fora do padrão ou datas inválidas", () => {
    expect(lerNomeArquivoKurier("escritorio.adv2_API_20261014_0900.csv")).toBeNull();
    expect(lerNomeArquivoKurier("escritorio.adv2_Lote-01_31022026.xlsx")).toBeNull();
  });
});
