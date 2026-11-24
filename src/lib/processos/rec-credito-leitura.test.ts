import { describe, expect, it } from "vitest";
import type { ItensRecCredito } from "./rec-credito";
import { casarPedidos, creditoDosTitulos, especieDoTitulo, mesmoItem, leituraRecCreditoVazia, sugestoesDaRecCredito, sugestoesDoCreditoPelosTitulos, tipoDaLista, type ItemSugerido, type LeituraRecCredito } from "./rec-credito-leitura";

const TIPOS = ["Nota promissória", "Duplicata", "CCB (Cédula de Crédito Bancário)"];
const nada: ItensRecCredito = { titulos: [], citacoes: [], pedidos: [], lancamentos: [] };
/** Conferidor de mentira: acha o trecho quando ele começa com "ok". */
const conferidor = { trecho: (pagina: number | null, trecho: string | null) => ({ pagina, conferido: Boolean(trecho?.startsWith("ok")) }) };
const de = (pagina: number, confianca: "alta" | "media" | "baixa" = "alta", trecho = "ok trecho") => ({ pagina, trecho, confianca });

function leitura(parcial: Partial<LeituraRecCredito>): LeituraRecCredito {
  return { ...leituraRecCreditoVazia(), ...parcial };
}

describe("tipo do título", () => {
  it("casa com a lista de Cadastros pelo texto", () => {
    expect(tipoDaLista("nota_promissoria", "Nota promissória", TIPOS)).toBe("Nota promissória");
    expect(tipoDaLista("ccb", "Cédula de Crédito Bancário", TIPOS)).toBe("CCB (Cédula de Crédito Bancário)");
    expect(tipoDaLista("cheque", "Cheque série AAA", TIPOS)).toBe("Cheque");
    expect(tipoDaLista("cheque", "Cheque", [...TIPOS, "Cheque"])).toBe("Cheque");
    expect(tipoDaLista("outro", "Confissão de dívida", TIPOS)).toBe("Confissão de dívida");
  });

  it("o tipo é a espécie do título: o número fica de fora", () => {
    expect(especieDoTitulo("Nota fiscal nº 111.222")).toBe("Nota fiscal");
    expect(especieDoTitulo("Nota fiscal de serviços nº 5550001")).toBe("Nota fiscal de serviços");
    expect(especieDoTitulo("NF-e nº 000111222, fatura 111222/01")).toBe("NF-e");
    expect(especieDoTitulo("Fatura nº 400100 — Detalhamento")).toBe("Fatura");
    expect(especieDoTitulo("Duplicata mercantil 40123/1")).toBe("Duplicata mercantil");
    expect(especieDoTitulo("CONFISSÃO DE DÍVIDA")).toBe("Confissão de dívida");
    expect(especieDoTitulo("Contrato n. 77")).toBe("Contrato");
    expect(especieDoTitulo("  ")).toBeNull();
  });

  it("nota fiscal, boleto e fatura são espécies conhecidas, mesmo quando vêm como \"outro\"", () => {
    expect(tipoDaLista("nota_fiscal", "Nota fiscal nº 111.222", TIPOS)).toBe("Nota fiscal");
    expect(tipoDaLista("outro", "Nota fiscal nº 111.222", TIPOS)).toBe("Nota fiscal");
    expect(tipoDaLista("outro", "NF-e nº 000111222, fatura 111222/01", TIPOS)).toBe("Nota fiscal");
    expect(tipoDaLista("outro", "Nota fiscal de serviços nº 5550001", [...TIPOS, "Nota Fiscal"])).toBe("Nota Fiscal");
    expect(tipoDaLista("outro", "Boleto bancário", TIPOS)).toBe("Boleto");
    expect(tipoDaLista("fatura", "Fatura nº 400100", TIPOS)).toBe("Fatura");
    // Espécie que não é das conhecidas: a da lista, se existir com outra caixa; senão a da peça, sem número.
    expect(tipoDaLista("outro", "TERMO DE CONFISSÃO nº 9", [...TIPOS, "Termo de confissão"])).toBe("Termo de confissão");
    expect(tipoDaLista("outro", "Warrant agropecuário 12/2024", TIPOS)).toBe("Warrant agropecuário");
  });
});

describe("petição e decisão do mesmo pedido de execução", () => {
  const pedido = (tipo: string, pedidoEm: string | null, situacao: string, decididoEm: string | null) => ({ tipo, pedidoEm, situacao, decididoEm });

  it("a decisão pega a data do pedido feito antes dela e o requerido some", () => {
    const casados = casarPedidos([pedido("SISBAJUD", "2022-07-29", "requerido", null), pedido("Sisbajud", null, "deferido", "2022-08-15")]);
    expect(casados).toEqual([pedido("Sisbajud", "2022-07-29", "deferido", "2022-08-15")]);
  });

  it("um pedido de três sistemas casa com as três decisões, uma de cada", () => {
    const casados = casarPedidos([
      pedido("INFOJUD", null, "deferido", "2022-06-21"),
      pedido("SISBAJUD, RENAJUD e INFOJUD", "2022-05-10", "requerido", null),
      pedido("RENAJUD", null, "deferido", "2022-06-21"),
      pedido("SISBAJUD", null, "indeferido", "2022-06-21"),
    ]);
    expect(casados.map((item) => [item.tipo, item.pedidoEm, item.situacao])).toEqual([
      ["INFOJUD", "2022-05-10", "deferido"],
      ["RENAJUD", "2022-05-10", "deferido"],
      ["SISBAJUD", "2022-05-10", "indeferido"],
    ]);
  });

  it("pedido só em parte decidido continua na lista", () => {
    const casados = casarPedidos([pedido("SISBAJUD e RENAJUD", "2022-05-10", "requerido", null), pedido("SISBAJUD", null, "deferido", "2022-06-21")]);
    expect(casados).toEqual([pedido("SISBAJUD e RENAJUD", "2022-05-10", "requerido", null), pedido("SISBAJUD", "2022-05-10", "deferido", "2022-06-21")]);
  });

  it("cada decisão fica com o pedido mais recente antes dela; o mesmo pedido não serve a duas decisões", () => {
    const casados = casarPedidos([
      pedido("SISBAJUD", "2022-07-01", "requerido", null),
      pedido("SISBAJUD", "2023-05-02", "requerido", null),
      pedido("SISBAJUD", null, "deferido", "2022-08-15"),
      pedido("SISBAJUD", null, "deferido", "2023-06-01"),
      pedido("SISBAJUD", null, "deferido", "2023-09-01"),
    ]);
    expect(casados.map((item) => [item.pedidoEm, item.decididoEm])).toEqual([
      ["2022-07-01", "2022-08-15"],
      ["2023-05-02", "2023-06-01"],
      [null, "2023-09-01"],
    ]);
  });

  it("a mesma decisão lida duas vezes pega a mesma data", () => {
    const casados = casarPedidos([pedido("RENAJUD", "2022-05-10", "requerido", null), pedido("RENAJUD", null, "deferido", "2022-06-21"), pedido("Renajud", null, "deferido", "2022-06-21")]);
    expect(casados.map((item) => item.pedidoEm)).toEqual(["2022-05-10", "2022-05-10"]);
  });

  it("não casa com pedido posterior à decisão, de outro tipo ou antigo demais", () => {
    const itens = [
      pedido("SISBAJUD", "2022-09-01", "requerido", null),
      pedido("Penhora de imóvel", "2022-05-01", "requerido", null),
      pedido("SISBAJUD", "2020-01-10", "requerido", null),
      pedido("SISBAJUD", null, "deferido", "2022-08-15"),
    ];
    expect(casarPedidos(itens)).toEqual(itens);
  });

  it("quem já tem a data do pedido, ou não tem a da decisão, fica como veio", () => {
    const itens = [pedido("SISBAJUD", "2022-07-01", "requerido", null), pedido("SISBAJUD", "2022-07-01", "deferido", "2022-08-15"), pedido("RENAJUD", null, "deferido", null)];
    expect(casarPedidos(itens)).toEqual(itens);
  });
});

describe("sugestões da Rec. Crédito", () => {
  it("um título por proposta, com o tipo da lista e os dados do formulário", () => {
    const sugestoes = sugestoesDaRecCredito(
      leitura({
        titulos: [
          { tipo: "duplicata", descricao: "Duplicata mercantil", numero: "101", valor: 1500.5, vencimento: "2024-01-10", ...de(3) },
          { tipo: "duplicata", descricao: "Duplicata", numero: "101", valor: 1500.5, vencimento: "10/01/2024", ...de(9, "media") },
          { tipo: "duplicata", descricao: "Duplicata", numero: null, valor: 0, vencimento: "2024-01-10", ...de(4) },
          { tipo: "duplicata", descricao: "Duplicata", numero: null, valor: 10, vencimento: "sem data", ...de(4) },
        ],
      }),
      nada,
      TIPOS,
      conferidor
    );
    expect(sugestoes).toHaveLength(1);
    expect(sugestoes[0]).toMatchObject({ tipo: "rec_credito", campo: "titulo", item: "rec_credito_titulo", pagina: 3, confianca: "alta", trechoConferido: true });
    expect(sugestoes[0].valor as ItemSugerido).toEqual({ item: "titulo", dados: { tipo: "Duplicata", numero: "101", valor: 1500.5, vencimento: "2024-01-10" }, tipos: TIPOS });
    expect(sugestoes[0].resumo).toMatch(/^Título: Duplicata nº 101, R\$\s?1\.500,50, vencimento 10\/01\/2024$/);
  });

  it("não repete o que a ficha já tem", () => {
    const existentes: ItensRecCredito = {
      ...nada,
      lancamentos: [{ id: "x", origem: "manual", documentoId: null, pagina: null, criadoPorNome: null, tipo: "levantamento", data: "2024-05-02", valor: 800, descricao: null }],
    };
    const sugestoes = sugestoesDaRecCredito(
      leitura({
        lancamentos: [
          { tipo: "levantamento", data: "2024-05-02", valor: 800, descricao: "alvará", ...de(20) },
          { tipo: "guia_paga", data: "2024-02-01", valor: 35.9, descricao: "diligência", ...de(12) },
        ],
      }),
      existentes,
      TIPOS,
      conferidor
    );
    expect(sugestoes.map((item) => (item.valor as ItemSugerido).dados.tipo)).toEqual(["guia_paga"]);
  });

  it("pedido e decisão do mesmo pedido: fica a situação decidida", () => {
    const sugestoes = sugestoesDaRecCredito(
      leitura({
        pedidos: [
          { tipo: "SISBAJUD", data_pedido: "2024-03-01", situacao: "requerido", data_decisao: null, resultado: null, valor_obtido: null, ...de(30) },
          { tipo: "Sisbajud", data_pedido: "2024-03-01", situacao: "deferido", data_decisao: "2024-03-20", resultado: "Bloqueio parcial", valor_obtido: 1200, ...de(35, "media") },
        ],
      }),
      nada,
      TIPOS,
      conferidor
    );
    expect(sugestoes).toHaveLength(1);
    expect((sugestoes[0].valor as ItemSugerido).dados).toMatchObject({ situacao: "deferido", decididoEm: "2024-03-20", valorObtido: 1200 });
  });

  it("trecho não localizado no PDF baixa a confiança", () => {
    const [sugestao] = sugestoesDaRecCredito(
      leitura({ citacoes: [{ data: "2024-02-10", meio: "ar", resultado: "negativa", endereco: "Rua A, 10", motivo: "Mudou-se", ...de(7, "alta", "texto inventado") }] }),
      nada,
      TIPOS,
      conferidor
    );
    expect(sugestao).toMatchObject({ confianca: "baixa", trechoConferido: false });
    expect((sugestao.valor as ItemSugerido).dados).toEqual({ tentativaEm: "2024-02-10", meio: "ar", resultado: "negativa", endereco: "Rua A, 10", observacao: "Mudou-se" });
  });

  it("autos do eproc não repetem o que os do e-SAJ já sugeriram, mesmo com a data um pouco diferente", () => {
    const doEsaj: ItemSugerido[] = [
      { item: "pedido", dados: { tipo: "RENAJUD e INFOJUD", pedidoEm: "2023-11-07", situacao: "indeferido", decididoEm: "2023-11-10" } },
      { item: "lancamento", dados: { tipo: "guia_paga", data: "2024-02-01", valor: 35.9 } },
    ];
    const sugestoes = sugestoesDaRecCredito(
      leitura({
        pedidos: [
          { tipo: "INFOJUD e RENAJUD", data_pedido: "2023-11-08", situacao: "indeferido", data_decisao: "2023-11-23", resultado: null, valor_obtido: null, ...de(40) },
          { tipo: "SISBAJUD", data_pedido: "2025-10-14", situacao: "deferido", data_decisao: null, resultado: null, valor_obtido: null, ...de(41) },
        ],
        lancamentos: [{ tipo: "guia_paga", data: "2024-02-03", valor: 35.9, descricao: null, ...de(12) }],
      }),
      nada,
      TIPOS,
      conferidor,
      doEsaj
    );
    expect(sugestoes.map((item) => (item.valor as ItemSugerido).dados.tipo)).toEqual(["SISBAJUD"]);
  });
});

describe("crédito pelos títulos", () => {
  const titulo = (valor: number, vencimento: string): ItemSugerido => ({ item: "titulo", dados: { tipo: "Duplicata", numero: null, valor, vencimento } });
  it("valor original é a soma dos títulos e a origem é o vencimento mais antigo de todos", () => {
    const credito = creditoDosTitulos([titulo(2929.83, "2022-08-26"), titulo(1785.97, "2022-09-06"), titulo(1785.97, "2022-09-06"), titulo(1785.97, "2022-09-16")]);
    expect(credito).toEqual({ valorOriginal: 6501.77, origem: "2022-08-26", quantidade: 3 });
    const sugestoes = sugestoesDoCreditoPelosTitulos(credito!, {});
    expect(sugestoes.map((item) => item.resumo)).toEqual([
      expect.stringMatching(/soma dos 3 títulos$/),
      "Data de origem do débito: 26/08/2022, vencimento mais antigo entre os 3 títulos",
    ]);
  });
});

describe("mesma citação", () => {
  it("sem data num dos dois, compara o endereço escrito de jeitos diferentes", () => {
    const a: ItemSugerido = { item: "citacao", dados: { tentativaEm: null, resultado: "positiva", endereco: "Avenida das Flores, nº 972, Jardim Azul, CEP 06.434-000, Cidade, SP" } };
    const b: ItemSugerido = { item: "citacao", dados: { tentativaEm: "2022-02-07", resultado: "positiva", endereco: "Avenida das Flores, nº 972, Jardim Azul, Cidade-SP, CEP 06434-000" } };
    const outra: ItemSugerido = { item: "citacao", dados: { tentativaEm: null, resultado: "positiva", endereco: "Rua dos Lírios, 15, Centro" } };
    expect(mesmoItem(a, b)).toBe(true);
    expect(mesmoItem(a, outra)).toBe(false);
  });
});
