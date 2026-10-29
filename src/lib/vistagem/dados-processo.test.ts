import { describe, expect, it } from "vitest";
import { classeDoProcesso, partesPorPolo, valorDaCausa } from "./dados-processo";

describe("classeDoProcesso", () => {
  it("tira o tipo do ato e deixa a classe em caixa de título", () => {
    expect(classeDoProcesso("Despacho AGRAVO DE INSTRUMENTO")).toBe("Agravo de Instrumento");
    expect(classeDoProcesso("DESPACHO/DECISÃO EXECUÇÃO DE TÍTULO EXTRAJUDICIAL")).toBe("Execução de Título Extrajudicial");
    expect(classeDoProcesso("Notificação AÇÃO TRABALHISTA - RITO ORDINÁRIO")).toBe("Ação Trabalhista - Rito Ordinário");
    expect(classeDoProcesso("Intimação de acórdão EMBARGOS DE DECLARAÇÃO CÍVEL")).toBe("Embargos de Declaração Cível");
    expect(classeDoProcesso("EMENTA / ACORDÃO AGRAVO EM RECURSO ESPECIAL")).toBe("Agravo em Recurso Especial");
    expect(classeDoProcesso("DECISÃO MONOCRÁTICA AGRAVO DE INSTRUMENTO EM RECURSO DE REVISTA")).toBe(
      "Agravo de Instrumento em Recurso de Revista"
    );
    expect(classeDoProcesso("VISTA à(s) parte(s) agravada(s) para impugnação do Agravo Interno (AgInt) AGRAVO EM RECURSO ESPECIAL")).toBe(
      "Agravo em Recurso Especial"
    );
  });

  it("sem classe em caixa alta, null", () => {
    expect(classeDoProcesso("Outros")).toBeNull();
    expect(classeDoProcesso(null)).toBeNull();
    expect(classeDoProcesso("DESPACHO")).toBeNull();
  });
});

describe("valorDaCausa", () => {
  it("lê o valor da causa quando o diário traz", () => {
    expect(valorDaCausa("Classe Processual: Execução de Título Extrajudicial Assunto Principal: Duplicata Valor da Causa: R$41.664,42 Exequente(s): X")).toBe(
      "R$ 41.664,42"
    );
    expect(valorDaCausa("Retifico o valor da causa para R$ 1.250.000,00, recolhendo-se a diferença.")).toBe("R$ 1.250.000,00");
    expect(valorDaCausa("Atribuo à causa o valor de R$ 50.000,00.")).toBe("R$ 50.000,00");
  });

  it("sem valor em reais, null", () => {
    expect(valorDaCausa("o valor da causa é inferior a 60 salários mínimos")).toBeNull();
    expect(valorDaCausa("IMPUGNAÇÃO AO VALOR DA CAUSA A reclamada sustentou")).toBeNull();
  });
});

describe("partesPorPolo", () => {
  it("separa polo ativo e passivo", () => {
    expect(
      partesPorPolo([
        { nome: "JOSE", polo: "A" },
        { nome: "EMPRESA", polo: "P" },
        { nome: "OUTRA", polo: "P" },
        { nome: "TERCEIRO", polo: "T" },
      ])
    ).toEqual({
      ativo: [{ nome: "JOSE", cliente: false }],
      passivo: [
        { nome: "EMPRESA", cliente: false },
        { nome: "OUTRA", cliente: false },
      ],
    });
  });

  it("marca o cliente da pasta e põe na frente, mesmo com grafia diferente no DJEN", () => {
    const { ativo } = partesPorPolo(
      [
        { nome: "7º CARTÓRIO DE REGISTRO DE IMÓVEIS DO RIO DE JANEIRO/RJ", polo: "A" },
        { nome: "ADALBERTO SALVADOR PERILO KUHL JUNIOR", polo: "A" },
      ],
      "Adalberto Salvador Perillo Kühl Júnior"
    );
    expect(ativo).toEqual([
      { nome: "ADALBERTO SALVADOR PERILO KUHL JUNIOR", cliente: true },
      { nome: "7º CARTÓRIO DE REGISTRO DE IMÓVEIS DO RIO DE JANEIRO/RJ", cliente: false },
    ]);
    expect(partesPorPolo([{ nome: "BANCO BRADESCO S.A.", polo: "P" }], "Banco Bradesco Financiamentos S.A.").passivo[0].cliente).toBe(false);
    expect(
      partesPorPolo([{ nome: "2. CDA COMERCIO INDUSTRIA DE METAIS LTDA EM RECUPERACAO JUDICIAL (AGRAVANTE)", polo: "A" }], "Cda Comercio Industria de Metais Ltda Em Recuperacao Judicial")
        .ativo
    ).toEqual([{ nome: "CDA COMERCIO INDUSTRIA DE METAIS LTDA EM RECUPERACAO JUDICIAL (AGRAVANTE)", cliente: true }]);
  });
});
