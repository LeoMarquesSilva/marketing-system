import { describe, expect, it } from "vitest";
import { classeDoProcesso, materiasDaLista, paragrafosDaSintese, partesPorPolo, precisaDeMateria, precisaDeSistema, sistemaDaLista, valorDaCausa } from "./dados-processo";

describe("precisaDeMateria", () => {
  const execucao = { id: "133", nome: "Execução de Título Extrajudicial" };

  it("só pede quando a pasta está sem Matéria", () => {
    expect(precisaDeMateria(true, [])).toBe(true);
    expect(precisaDeMateria(false, [])).toBe(false);
  });

  it("um pedido com Matéria na fila ou gravado resolve, mesmo antes da próxima carga do SIOE", () => {
    for (const status of ["pendente", "enviado", "processando", "concluido"] as const) {
      expect(precisaDeMateria(true, [{ materias: [execucao], status, simulado: false }])).toBe(false);
    }
  });

  it("volta a pedir se o pedido deu erro ou só foi simulado", () => {
    expect(precisaDeMateria(true, [{ materias: [execucao], status: "erro", simulado: false }])).toBe(true);
    expect(precisaDeMateria(true, [{ materias: [execucao], status: "concluido", simulado: true }])).toBe(true);
  });

  it("um pedido na fila sem Matéria não resolve", () => {
    expect(precisaDeMateria(true, [{ materias: [], status: "pendente", simulado: false }])).toBe(true);
  });
});

describe("precisaDeSistema", () => {
  const pje = { id: "223", nome: "pje" };

  it("só exige quando a pasta está sem Sistema do Tribunal", () => {
    expect(precisaDeSistema(true, [])).toBe(true);
    expect(precisaDeSistema(false, [])).toBe(false);
  });

  it("um pedido com Sistema na fila ou gravado resolve; com erro, simulado ou sem Sistema, não", () => {
    expect(precisaDeSistema(true, [{ sistemaTribunal: pje, status: "pendente", simulado: false }])).toBe(false);
    expect(precisaDeSistema(true, [{ sistemaTribunal: pje, status: "concluido", simulado: false }])).toBe(false);
    expect(precisaDeSistema(true, [{ sistemaTribunal: pje, status: "erro", simulado: false }])).toBe(true);
    expect(precisaDeSistema(true, [{ sistemaTribunal: pje, status: "concluido", simulado: true }])).toBe(true);
    expect(precisaDeSistema(true, [{ sistemaTribunal: null, status: "pendente", simulado: false }])).toBe(true);
  });
});

describe("sistemaDaLista", () => {
  const lista = [
    { id: "222", nome: "E-saj" },
    { id: "223", nome: "pje" },
  ];

  it("troca o id pelo sistema da lista", () => {
    expect(sistemaDaLista(" 223 ", lista)).toEqual({ sistema: lista[1], fora: false });
  });

  it("sem escolha, nada; fora da lista, aponta", () => {
    expect(sistemaDaLista(null, lista)).toEqual({ sistema: null, fora: false });
    expect(sistemaDaLista("", lista)).toEqual({ sistema: null, fora: false });
    expect(sistemaDaLista(223, lista)).toEqual({ sistema: null, fora: false });
    expect(sistemaDaLista("999", lista)).toEqual({ sistema: null, fora: true });
  });
});

describe("materiasDaLista", () => {
  const lista = [
    { id: "133", nome: "Execução de Título Extrajudicial" },
    { id: "150", nome: "Ação de Exigir Contas" },
  ];

  it("troca os ids pelas matérias da lista, sem repetir", () => {
    expect(materiasDaLista(["150", " 133 ", "150"], lista)).toEqual({ materias: [lista[1], lista[0]], fora: [] });
  });

  it("aponta o que a lista do VIOS não tem", () => {
    expect(materiasDaLista(["133", "999"], lista)).toEqual({ materias: [lista[0]], fora: ["999"] });
  });

  it("ignora o que não é lista de ids", () => {
    expect(materiasDaLista(undefined, lista)).toEqual({ materias: [], fora: [] });
    expect(materiasDaLista("133", lista)).toEqual({ materias: [], fora: [] });
    expect(materiasDaLista([133, null, ""], lista)).toEqual({ materias: [], fora: [] });
  });
});

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

describe("paragrafosDaSintese", () => {
  it("quebra antes da data e do traço colados no texto", () => {
    expect(paragrafosDaSintese("30/08/2021 Conclusos para despacho08/11/2021 Juntado pedido, desde 08/2021.24/06: Citação infrutífera.")).toEqual([
      "30/08/2021 Conclusos para despacho",
      "08/11/2021 Juntado pedido, desde 08/2021.",
      "24/06: Citação infrutífera.",
    ]);
    expect(paragrafosDaSintese("Cobrança contra LPS Transportes.- Julgada procedente, R$19.289,76- Iniciado cumprimento")).toEqual([
      "Cobrança contra LPS Transportes.",
      "- Julgada procedente, R$19.289,76",
      "- Iniciado cumprimento",
    ]);
  });

  it("não quebra data no meio da frase, traço com espaço antes nem palavra hifenizada", () => {
    expect(paragrafosDaSintese("09/02/2024 Decisão - Intime-se a exequente em 05/01/2024, processo nº 0028321/2025.")).toEqual([
      "09/02/2024 Decisão - Intime-se a exequente em 05/01/2024, processo nº 0028321/2025.",
    ]);
  });

  it("traduz as entidades HTML, com o ':' que o CSV põe no lugar do ';'", () => {
    expect(paragrafosDaSintese("17/11/2025 &ndash: Oposição &ldquo:Embargos&rdquo: &bull: R&amp;D &#8727: S&A")).toEqual([
      "17/11/2025 – Oposição “Embargos” • R&D ∗ S&A",
    ]);
  });

  it("vazia, sem parágrafos", () => {
    expect(paragrafosDaSintese(null)).toEqual([]);
    expect(paragrafosDaSintese("   ")).toEqual([]);
  });
});
