import { describe, expect, it } from "vitest";
import { acordoEmDestaque, colunasDaParcela, colunasDoAcordo, gerarParcelas, levantamentosDosAcordos, planoDoFormulario, resumoDoAcordo, somarMeses, type Acordo, type Parcela } from "./acordos";

const parcela = (numero: number, vencimento: string, valor: number, pagoEm: string | null = null, valorPago: number | null = null): Parcela => ({
  id: `p${numero}`,
  numero,
  vencimento,
  valor,
  pagoEm,
  valorPago: pagoEm ? (valorPago ?? valor) : null,
  observacao: null,
  origem: "manual",
  documentoId: null,
  pagina: null,
});

const acordo = (parcelas: Parcela[], extra: Partial<Acordo> = {}): Acordo => ({
  id: "a1",
  processoId: "x",
  posicao: "recebe",
  celebradoEm: "2026-01-10",
  homologadoEm: null,
  valorTotal: 3000,
  multaPercentual: null,
  situacao: "vigente",
  descumpridoEm: null,
  observacao: null,
  origem: "manual",
  documentoId: null,
  pagina: null,
  criadoPorNome: null,
  parcelas,
  ...extra,
});

describe("parcelas do acordo", () => {
  it("soma meses mantendo o dia, sem passar do fim do mês", () => {
    expect(somarMeses("2026-01-31", 1)).toBe("2026-02-28");
    expect(somarMeses("2028-01-31", 1)).toBe("2028-02-29");
    expect(somarMeses("2026-11-15", 3)).toBe("2027-02-15");
  });

  it("divide o saldo igual e põe os centavos que sobram na última", () => {
    const parcelas = gerarParcelas({ valorTotal: 1000, entrada: { valor: 100, vencimento: "2026-01-05" }, quantidade: 3, primeiroVencimento: "2026-02-10", periodicidade: "mensal", valorParcela: null });
    expect(parcelas).toEqual([
      { numero: 0, vencimento: "2026-01-05", valor: 100 },
      { numero: 1, vencimento: "2026-02-10", valor: 300 },
      { numero: 2, vencimento: "2026-03-10", valor: 300 },
      { numero: 3, vencimento: "2026-04-10", valor: 300 },
    ]);
    const quebrado = gerarParcelas({ valorTotal: 100, entrada: null, quantidade: 3, primeiroVencimento: "2026-02-10", periodicidade: "quinzenal", valorParcela: null });
    expect(quebrado.map((item) => item.valor)).toEqual([33.33, 33.33, 33.34]);
    expect(quebrado.map((item) => item.vencimento)).toEqual(["2026-02-10", "2026-02-25", "2026-03-12"]);
  });

  it("usa o valor da parcela que o acordo diz, quando diz", () => {
    const parcelas = gerarParcelas({ valorTotal: 1000, entrada: null, quantidade: 2, primeiroVencimento: "2026-02-10", periodicidade: "semanal", valorParcela: 520 });
    expect(parcelas.map((item) => [item.vencimento, item.valor])).toEqual([
      ["2026-02-10", 520],
      ["2026-02-17", 520],
    ]);
  });

  it("recusa entrada maior que o total e quantidade absurda", () => {
    expect(() => gerarParcelas({ valorTotal: 100, entrada: { valor: 150, vencimento: "2026-01-01" }, quantidade: 2, primeiroVencimento: "2026-02-01", periodicidade: "mensal", valorParcela: null })).toThrow();
    expect(() => gerarParcelas({ valorTotal: 100, entrada: null, quantidade: 1000, primeiroVencimento: "2026-02-01", periodicidade: "mensal", valorParcela: null })).toThrow();
  });
});

describe("situação do acordo", () => {
  const parcelas = [parcela(1, "2026-02-10", 1000, "2026-02-09"), parcela(2, "2026-03-10", 1000), parcela(3, "2026-04-10", 1000)];

  it("em dia, em atraso e cumprido pelas parcelas", () => {
    expect(resumoDoAcordo(acordo(parcelas), "2026-03-01")).toMatchObject({ situacao: "em_dia", pagas: 1, vencidas: 0, valorPago: 1000, saldo: 2000, proxima: { numero: 2, vencimento: "2026-03-10" } });
    expect(resumoDoAcordo(acordo(parcelas), "2026-03-25")).toMatchObject({ situacao: "em_atraso", vencidas: 1, diasDeAtraso: 15 });
    // Vence hoje ainda não é atraso.
    expect(resumoDoAcordo(acordo(parcelas), "2026-03-10").situacao).toBe("em_dia");
    const todas = parcelas.map((item) => ({ ...item, pagoEm: item.vencimento, valorPago: item.valor }));
    expect(resumoDoAcordo(acordo(todas), "2026-05-01")).toMatchObject({ situacao: "cumprido", saldo: 0, proxima: null });
  });

  it("descumprido e cancelado valem como declarados", () => {
    expect(resumoDoAcordo(acordo(parcelas, { situacao: "descumprido" }), "2026-03-01").situacao).toBe("descumprido");
    expect(resumoDoAcordo(acordo(parcelas, { situacao: "cancelado" }), "2026-03-25").situacao).toBe("cancelado");
  });
});

describe("dinheiro do acordo na Rec. Crédito", () => {
  it("parcela paga em acordo que o cliente recebe vira levantamento; pago pelo cliente ou cancelado, não", () => {
    const parcelas = [parcela(0, "2026-01-10", 500, "2026-01-10"), parcela(1, "2026-02-10", 1000, "2026-02-12", 980), parcela(2, "2026-03-10", 1000)];
    expect(levantamentosDosAcordos([acordo(parcelas)])).toEqual([
      { tipo: "levantamento", data: "2026-01-10", valor: 500, descricao: "entrada do acordo" },
      { tipo: "levantamento", data: "2026-02-12", valor: 980, descricao: "parcela 1 de 2 do acordo" },
    ]);
    expect(levantamentosDosAcordos([acordo(parcelas, { posicao: "paga" })])).toEqual([]);
    expect(levantamentosDosAcordos([acordo(parcelas, { situacao: "cancelado" })])).toEqual([]);
  });

  it("na carteira, destaca o acordo mais recente que não foi cancelado", () => {
    const antigo = acordo([], { id: "antigo", celebradoEm: "2025-01-01" });
    const novoCancelado = acordo([], { id: "cancelado", celebradoEm: "2026-06-01", situacao: "cancelado" });
    expect(acordoEmDestaque([antigo, novoCancelado])?.id).toBe("antigo");
    expect(acordoEmDestaque([novoCancelado])?.id).toBe("cancelado");
    expect(acordoEmDestaque([])).toBeNull();
  });
});

describe("validação dos formulários", () => {
  it("lê o acordo e o plano no formato brasileiro", () => {
    expect(colunasDoAcordo({ posicao: "paga", valorTotal: "12.000,50", celebradoEm: "2026-01-10", multaPercentual: "20" })).toMatchObject({ posicao: "paga", valor_total: 12000.5, multa_percentual: 20 });
    expect(() => colunasDoAcordo({ valorTotal: "" })).toThrow();
    expect(planoDoFormulario({ quantidade: "10", primeiroVencimento: "2026-02-10" }, 1000)).toMatchObject({ quantidade: 10, periodicidade: "mensal", entrada: null });
    expect(() => planoDoFormulario({ quantidade: "0" }, 1000)).toThrow(/parcelas ou a entrada/);
    expect(() => planoDoFormulario({ entradaValor: "100", quantidade: "0" }, 1000)).toThrow(/vencimento da entrada/);
  });

  it("parcela paga sem valor pago assume o valor da parcela; sem data de pagamento, fica em aberto", () => {
    expect(colunasDaParcela({ vencimento: "2026-02-10", valor: "1.000,00", pagoEm: "2026-02-11" })).toMatchObject({ pago_em: "2026-02-11", valor_pago: 1000 });
    expect(colunasDaParcela({ vencimento: "2026-02-10", valor: "1000", valorPago: "900" })).toMatchObject({ pago_em: null, valor_pago: null });
  });
});
