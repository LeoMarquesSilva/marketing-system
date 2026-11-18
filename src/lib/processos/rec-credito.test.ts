import { describe, expect, it } from "vitest";
import { TabelaTjsp } from "./calculo-tjsp";
import { colunasDoItem, encargosDoProcesso, lerValor, linhaDaCarteira, memoriaDoValorDaAcao, processoEncerrado, situacaoDaCitacao, type Citacao, type DadosDoProcessoNaCarteira, type ItensRecCredito } from "./rec-credito";

const tabela = new TabelaTjsp([
  { mes: "2023-01-01", tabelaPratica: 100, taxaLegal: null },
  { mes: "2023-02-01", tabelaPratica: 101, taxaLegal: null },
  { mes: "2023-03-01", tabelaPratica: 110, taxaLegal: null },
]);

const comum = { origem: "manual" as const, documentoId: null, pagina: null, criadoPorNome: null };

const processo: DadosDoProcessoNaCarteira = {
  id: "p1",
  ci: "100",
  cnj: null,
  grupoCliente: "Grupo Teste",
  cliente: "Cliente Teste",
  devedor: "Devedor Teste",
  acao: "Execução de Título Extrajudicial",
  fase: "Execução",
  situacao: "Ativo",
  dataDistribuicao: "2023-02-15",
  dataCadastro: "2023-02-20",
  dataEncerramento: null,
  valorAcao: null,
  valorOriginalCadastro: null,
  proximosPassos: "Pedir SISBAJUD",
};

function citacao(resultado: Citacao["resultado"], endereco: string | null = null): Citacao {
  return { ...comum, id: resultado + String(endereco), endereco, tentativaEm: "2023-02-01", meio: "ar", resultado, observacao: null };
}

describe("validação dos itens", () => {
  it("lê valor no formato brasileiro", () => {
    expect(lerValor("1.234,56")).toBe(1234.56);
    expect(lerValor("R$ 10,5")).toBe(10.5);
    expect(lerValor("99.9")).toBe(99.9);
    expect(lerValor("")).toBeNull();
    expect(lerValor("abc")).toBeNaN();
  });

  it("monta as colunas do título e exige valor e vencimento", () => {
    expect(colunasDoItem("titulo", { tipo: "Duplicata", numero: " 101 ", valor: "1.000,00", vencimento: "2023-01-15" })).toEqual({ tipo: "Duplicata", numero: "101", valor: 1000, vencimento: "2023-01-15" });
    expect(() => colunasDoItem("titulo", { tipo: "Duplicata", valor: "0", vencimento: "2023-01-15" })).toThrow(/Valor inválido/);
    expect(() => colunasDoItem("titulo", { tipo: "Duplicata", valor: "10" })).toThrow(/vencimento/);
    expect(() => colunasDoItem("titulo", { tipo: "Duplicata", valor: "10", vencimento: "15/01/2023" })).toThrow(/Data inválida/);
  });

  it("citação e pedido usam os padrões e recusam opção fora da lista", () => {
    expect(colunasDoItem("citacao", { endereco: "Rua A, 1" })).toMatchObject({ meio: "ar", resultado: "pendente", endereco: "Rua A, 1" });
    expect(() => colunasDoItem("citacao", { resultado: "talvez" })).toThrow(/opção válida/);
    expect(colunasDoItem("pedido", { tipo: "SISBAJUD" })).toMatchObject({ situacao: "requerido", valor_obtido: null });
    expect(() => colunasDoItem("lancamento", { tipo: "outro", data: "2023-01-01", valor: "1" })).toThrow(/opção válida/);
  });
});

describe("situação da citação", () => {
  it("positiva se alguma deu certo, negativa só se todas falharam", () => {
    expect(situacaoDaCitacao([])).toBe("sem_tentativa");
    expect(situacaoDaCitacao([citacao("negativa"), citacao("positiva")])).toBe("positiva");
    expect(situacaoDaCitacao([citacao("negativa"), citacao("negativa")])).toBe("negativa");
    expect(situacaoDaCitacao([citacao("negativa"), citacao("pendente")])).toBe("pendente");
  });
});

describe("linha da carteira", () => {
  const itens: ItensRecCredito = {
    titulos: [{ ...comum, id: "t1", tipo: "Duplicata", numero: "1", valor: 1000, vencimento: "2023-01-15" }],
    citacoes: [citacao("negativa", "Rua A, 1"), citacao("negativa", "Rua A, 1"), citacao("positiva", "Rua B, 2")],
    pedidos: [{ ...comum, id: "x", pedidoEm: "2023-03-01", tipo: "SISBAJUD", descricao: null, situacao: "deferido", decididoEm: null, resultado: "Bloqueio parcial", valorObtido: 200 }],
    lancamentos: [
      { ...comum, id: "g", tipo: "guia_paga", data: "2023-02-01", valor: 50, descricao: null },
      { ...comum, id: "l", tipo: "levantamento", data: "2023-03-10", valor: 200, descricao: null },
    ],
  };

  it("calcula no ajuizamento e hoje, soma guias e recuperado e dá o saving", () => {
    const linha = linhaDaCarteira(processo, itens, tabela, "2023-03-15", "2023-03-01");
    // Ajuizamento (15/02): correção 101/100 e juros pro rata de 17/31 + 14/28 de mês. Hoje (15/03): 110/100 e 2 meses.
    expect(linha.valorNoAjuizamento).toBe(1020.59);
    expect(linha.valorAtualizado).toBe(1122);
    expect(linha.valorOriginal).toBe(1000);
    expect(linha.tiposCredito).toEqual(["Duplicata"]);
    expect(linha.citacao).toBe("positiva");
    expect(linha.enderecosTentados).toEqual(["Rua A, 1", "Rua B, 2"]);
    expect(linha.pedidosDeferidos).toBe(1);
    expect(linha.guiasPagas).toBe(50);
    expect(linha.valorRecuperado).toBe(200);
    expect(linha.saving).toBe(17.8);
    expect(linha.duracao).toEqual({ meses: 1, rotulo: "1 mês", desde: "distribuicao" });
    expect(linha.avisos).toEqual([]);
  });

  it("para a conta no último mês com índice e avisa o que faltou", () => {
    const linha = linhaDaCarteira({ ...processo, dataDistribuicao: null }, itens, tabela, "2023-06-10", "2023-03-01");
    expect(linha.valorAtualizado).not.toBeNull();
    expect(linha.valorNoAjuizamento).toBeNull();
    expect(linha.avisos[0]).toMatch(/data da distribuição/);
    expect(linha.duracao?.desde).toBe("cadastro");
  });

  it("sem títulos, mostra o valor original do cadastro e não calcula", () => {
    const linha = linhaDaCarteira({ ...processo, valorOriginalCadastro: 5000 }, { titulos: [], citacoes: [], pedidos: [], lancamentos: [] }, tabela, "2023-03-15", "2023-03-01");
    expect(linha.valorOriginal).toBe(5000);
    expect(linha.valorAtualizado).toBeNull();
    expect(linha.saving).toBeNull();
    expect(linha.citacao).toBe("sem_tentativa");
  });

  it("encerrado: pela data de encerramento ou pela situação", () => {
    expect(processoEncerrado({ situacao: "Ativo", dataEncerramento: null })).toBe(false);
    expect(processoEncerrado({ situacao: "Arquivado definitivamente", dataEncerramento: null })).toBe(true);
    expect(processoEncerrado({ situacao: null, dataEncerramento: "2024-01-01" })).toBe(true);
  });
});

describe("memória do valor da ação atualizado", () => {
  it("atualiza a ação desde a distribuição, soma guias só corrigidas e abate levantamentos com juros", () => {
    const memoria = memoriaDoValorDaAcao(
      tabela,
      1000,
      "2023-01-15",
      [
        { tipo: "guia_paga", data: "2023-02-15", valor: 100, descricao: "diligência" },
        { tipo: "levantamento", data: "2023-02-15", valor: 200, descricao: "alvará" },
      ],
      "2023-03-15",
      "2023-03-01"
    )!;
    expect(memoria.linhas.map((linha) => [linha.tipo, linha.sinal, linha.total])).toEqual([
      ["acao", 1, 1122],
      // Levantamento: abatido pelo mesmo critério da dívida (correção e juros desde 15/02).
      ["levantamento", -1, expect.any(Number)],
      // Guia: 100 × 110/101, sem juros.
      ["guia", 1, 108.91],
    ]);
    const levantado = memoria.linhas[1];
    expect(levantado.juros).toBeGreaterThan(0);
    expect(memoria.total).toBe(Math.round((1122 + 108.91 - levantado.total) * 100) / 100);
  });

  it("sem distribuição, sem valor ou sem índices não calcula", () => {
    expect(memoriaDoValorDaAcao(tabela, 1000, null, [], "2023-03-15", "2023-03-01")).toBeNull();
    expect(memoriaDoValorDaAcao(tabela, 0, "2023-01-15", [], "2023-03-15", "2023-03-01")).toBeNull();
    expect(memoriaDoValorDaAcao(null, 1000, "2023-01-15", [], "2023-03-15", "2023-03-01")).toBeNull();
  });

  it("levantamento maior que a dívida deixa o saldo em zero, com aviso", () => {
    const memoria = memoriaDoValorDaAcao(tabela, 100, "2023-01-15", [{ tipo: "levantamento", data: "2023-01-20", valor: 500, descricao: null }], "2023-03-15", "2023-03-01")!;
    expect(memoria.total).toBe(0);
    expect(memoria.avisos[0]).toMatch(/superam o débito/);
  });

  it("multa e honorários sobre a dívida já abatida, sem honorários sobre a multa, e guias depois", () => {
    const encargos = encargosDoProcesso("Cumprimento de sentença", null, null);
    expect(encargos).toMatchObject({ honorarios: 10, multa: 10 });
    const memoria = memoriaDoValorDaAcao(tabela, 1000, "2023-01-15", [{ tipo: "guia_paga", data: "2023-02-15", valor: 100, descricao: null }], "2023-03-15", "2023-03-01", encargos)!;
    expect(memoria.linhas.map((linha) => [linha.tipo, linha.total])).toEqual([
      ["acao", 1122],
      ["multa", 112.2],
      ["honorarios", 112.2],
      ["guia", 108.91],
    ]);
    expect(memoria.total).toBe(1455.31);
  });

  it("padrões pela ação e percentual informado por cima", () => {
    expect(encargosDoProcesso("Execução de Título Extrajudicial", null, null)).toMatchObject({ honorarios: 10, multa: 0 });
    expect(encargosDoProcesso("Monitória", null, null)).toMatchObject({ honorarios: 0, multa: 0 });
    expect(encargosDoProcesso("Cumprimento de sentença", 15, 0)).toMatchObject({ honorarios: 15, multa: 0, origem: "informados na ficha do processo" });
  });
});
