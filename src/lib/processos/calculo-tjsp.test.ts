import { describe, expect, it } from "vitest";
import { IndiceAusente, TabelaTjsp, atualizarCredito, atualizarTitulo, corrigirValor, duracaoDoProcesso, percentualRecuperado } from "./calculo-tjsp";

const tabela = new TabelaTjsp([
  { mes: "2023-01-01", tabelaPratica: 100, taxaLegal: null },
  { mes: "2023-02-01", tabelaPratica: 101, taxaLegal: null },
  { mes: "2023-03-01", tabelaPratica: 110, taxaLegal: null },
  { mes: "2024-08-01", tabelaPratica: 120, taxaLegal: 0.6 },
  { mes: "2024-09-01", tabelaPratica: 121, taxaLegal: 0.7 },
  { mes: "2024-10-01", tabelaPratica: 122, taxaLegal: -0.2 },
]);

describe("correção pela Tabela Prática", () => {
  it("multiplica pelo índice do mês final e divide pelo do mês inicial", () => {
    expect(tabela.fatorCorrecao("2023-01-15", "2023-03-20")).toBeCloseTo(1.1, 10);
    expect(corrigirValor(tabela, 1000, "2023-01-15", "2023-03-20")).toBe(1100);
  });

  it("não corrige quando a data final não passa da inicial", () => {
    expect(tabela.fatorCorrecao("2023-03-20", "2023-01-15")).toBe(1);
  });

  it("acusa o mês sem índice", () => {
    expect(() => tabela.fatorCorrecao("2023-01-15", "2025-01-10")).toThrow(IndiceAusente);
  });
});

describe("juros de mora", () => {
  it("1% ao mês pro rata pelos dias, antes da Lei 14.905", () => {
    // 17/31 de janeiro + fevereiro inteiro + 14/31 de março = 2 meses.
    expect(tabela.percentualJuros("2023-01-15", "2023-03-15")).toBeCloseTo(2, 10);
  });

  it("divide o mês da virada: 1% até 27/08/2024 e a taxa legal depois", () => {
    // Agosto: 8 dias a 1% e 4 dias a 0,6%; setembro: 9 dias a 0,7%.
    const esperado = (8 / 31) * 1 + (4 / 31) * 0.6 + (9 / 30) * 0.7;
    expect(tabela.percentualJuros("2024-08-20", "2024-09-10")).toBeCloseTo(esperado, 10);
  });

  it("taxa legal negativa conta como zero", () => {
    expect(tabela.percentualJuros("2024-10-01", "2024-10-31")).toBe(0);
  });

  it("taxa legal ainda não publicada é erro", () => {
    expect(() => tabela.percentualJuros("2023-02-01", "2023-03-10")).not.toThrow();
    const semTaxa = new TabelaTjsp([{ mes: "2024-09-01", tabelaPratica: 121, taxaLegal: null }]);
    expect(() => semTaxa.percentualJuros("2024-09-01", "2024-09-10")).toThrow(IndiceAusente);
  });
});

describe("títulos e crédito", () => {
  it("juros incidem sobre o valor corrigido", () => {
    const titulo = atualizarTitulo(tabela, { valor: 1000, vencimento: "2023-01-15" }, "2023-03-15");
    expect(titulo.corrigido).toBe(1100);
    expect(titulo.jurosPercentual).toBe(2);
    expect(titulo.juros).toBe(22);
    expect(titulo.total).toBe(1122);
  });

  it("soma os títulos na data final", () => {
    const credito = atualizarCredito(
      tabela,
      [
        { valor: 1000, vencimento: "2023-01-15" },
        { valor: 500, vencimento: "2023-02-15" },
      ],
      "2023-03-15",
    );
    expect(credito.original).toBe(1500);
    expect(credito.titulos).toHaveLength(2);
    expect(credito.total).toBe(credito.titulos[0].total + credito.titulos[1].total);
  });
});

describe("indicadores da carteira", () => {
  it("saving em % do crédito atualizado", () => {
    expect(percentualRecuperado(250, 1000)).toBe(25);
    expect(percentualRecuperado(250, 0)).toBeNull();
  });

  it("duração por extenso", () => {
    expect(duracaoDoProcesso("2020-01-15", "2022-04-10")).toEqual({ meses: 26, rotulo: "2 anos e 2 meses" });
    expect(duracaoDoProcesso("2026-11-01", "2026-11-17")?.rotulo).toBe("menos de 1 mês");
    expect(duracaoDoProcesso(null, "2026-11-17")).toBeNull();
  });
});
