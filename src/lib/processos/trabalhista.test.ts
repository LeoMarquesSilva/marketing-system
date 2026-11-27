import { describe, expect, it } from "vitest";
import { calcularPreenchimento } from "./preenchimento";
import {
  advogadosDoReclamante,
  calcularAdicional,
  calcularRiscoDoProcesso,
  colunasDoItemTrabalhista,
  descreverItemTrabalhista,
  ehTrabalhista,
  parametrosDoAdicional,
  resultadoFinal,
  salarioMinimoDoMes,
} from "./trabalhista";
import type { Parte } from "./types";

function parte(dados: Partial<Parte>): Parte {
  return {
    id: dados.id ?? "p1",
    polo: dados.polo ?? "ativo",
    papel: dados.papel ?? "parte",
    vinculo: null,
    devedor: false,
    referenteA: dados.referenteA ?? null,
    origem: "manual",
    pessoaId: `pessoa-${dados.id ?? "p1"}`,
    nome: dados.nome ?? "Fulana de Tal",
    documento: null,
    oab: dados.oab ?? null,
    observacao: null,
    enderecos: [],
    contatos: dados.contatos ?? [],
  };
}

describe("ehTrabalhista", () => {
  it("reconhece as grafias da área", () => {
    expect(ehTrabalhista("Trabalhista")).toBe(true);
    expect(ehTrabalhista("TRABALHISTA - Contencioso")).toBe(true);
    expect(ehTrabalhista("Recuperação de Crédito")).toBe(false);
    expect(ehTrabalhista(null)).toBe(false);
  });
});

describe("salário-mínimo", () => {
  it("usa a vigência do mês, inclusive as trocas no meio do ano", () => {
    expect(salarioMinimoDoMes("2020-01")).toBe(1039);
    expect(salarioMinimoDoMes("2020-02")).toBe(1045);
    expect(salarioMinimoDoMes("2023-04")).toBe(1302);
    expect(salarioMinimoDoMes("2023-05")).toBe(1320);
    expect(salarioMinimoDoMes("2024-12")).toBe(1412);
    expect(salarioMinimoDoMes("2009-12")).toBeNull();
  });
});

describe("calcularAdicional", () => {
  it("40% do mínimo de cada mês inteiro, mais 15% de reflexos", () => {
    const resultado = calcularAdicional({ inicio: "2024-01-01", fim: "2024-03-31", percentual: 40, base: "salario_minimo", salario: null, reflexosPercentual: 15, afastamentos: [] });
    expect(resultado.meses.map((mes) => mes.valor)).toEqual([564.8, 564.8, 564.8]);
    expect(resultado.principal).toBe(1694.4);
    expect(resultado.reflexos).toBe(254.16);
    expect(resultado.total).toBe(1948.56);
  });

  it("mês quebrado vale dias ÷ 30, e muda de valor na virada do ano", () => {
    const resultado = calcularAdicional({ inicio: "2024-12-16", fim: "2025-01-10", percentual: 40, base: "salario_minimo", salario: null, reflexosPercentual: 0, afastamentos: [] });
    expect(resultado.meses).toEqual([
      { mes: "2024-12", dias: 16, fracao: 0.5333, base: 1412, valor: 301.23 },
      { mes: "2025-01", dias: 10, fracao: 0.3333, base: 1518, valor: 202.4 },
    ]);
  });

  it("tira os dias de afastamento pelo INSS, sem contar duas vezes os que se sobrepõem", () => {
    const resultado = calcularAdicional({
      inicio: "2024-01-01",
      fim: "2024-03-31",
      percentual: 40,
      base: "salario_minimo",
      salario: null,
      reflexosPercentual: 15,
      afastamentos: [
        { inicio: "2024-02-01", fim: "2024-02-29" },
        { inicio: "2024-02-10", fim: "2024-02-20" },
      ],
    });
    expect(resultado.meses.map((mes) => mes.mes)).toEqual(["2024-01", "2024-03"]);
    expect(resultado.diasAfastado).toBe(29);
    expect(resultado.principal).toBe(1129.6);
  });

  it("afastamento sem alta vai até o fim do período", () => {
    const resultado = calcularAdicional({ inicio: "2024-01-01", fim: "2024-02-29", percentual: 20, base: "salario_minimo", salario: null, reflexosPercentual: 0, afastamentos: [{ inicio: "2024-02-01", fim: null }] });
    expect(resultado.meses).toHaveLength(1);
    expect(resultado.principal).toBe(282.4);
  });

  it("periculosidade: 30% do salário contratual", () => {
    const resultado = calcularAdicional({ inicio: "2024-01-01", fim: "2024-01-31", percentual: 30, base: "salario_contratual", salario: 2000, reflexosPercentual: 15, afastamentos: [] });
    expect(resultado.total).toBe(690);
  });

  it("recusa período invertido e base contratual sem salário", () => {
    expect(() => calcularAdicional({ inicio: "2024-02-01", fim: "2024-01-01", percentual: 40, base: "salario_minimo", salario: null, reflexosPercentual: 15, afastamentos: [] })).toThrow(/anterior/);
    expect(() => calcularAdicional({ inicio: "2024-01-01", fim: "2024-01-31", percentual: 30, base: "salario_contratual", salario: null, reflexosPercentual: 15, afastamentos: [] })).toThrow(/salário/);
  });
});

describe("parametrosDoAdicional", () => {
  it("sem período de cálculo, usa o contrato; na rescisão indireta, o último dia trabalhado", () => {
    const parametros = parametrosDoAdicional({
      data_admissao: "2020-03-02",
      data_termino: "2023-08-10",
      tipo_termino: "rescisao_indireta",
      ultimo_dia_trabalhado: "2023-05-31",
      laudo_agente: "insalubridade",
      laudo_grau: "maximo",
    });
    expect(parametros).toMatchObject({ inicio: "2020-03-02", fim: "2023-05-31", percentual: 40, base: "salario_minimo", reflexosPercentual: 15, faltando: [] });
  });

  it("o grau e o período da decisão valem sobre o laudo e o contrato", () => {
    const parametros = parametrosDoAdicional({
      data_admissao: "2015-01-05",
      data_termino: "2023-08-10",
      periodo_calculo_inicio: "2018-06-01",
      periodo_calculo_fim: "2023-08-10",
      laudo_grau: "maximo",
      adicional_grau: "medio",
      risco_reflexos_percentual: 10,
    });
    expect(parametros).toMatchObject({ inicio: "2018-06-01", percentual: 20, reflexosPercentual: 10 });
  });

  it("diz o que falta", () => {
    expect(parametrosDoAdicional({}).faltando).toHaveLength(3);
    expect(calcularRiscoDoProcesso({}, []).resultado).toBeNull();
  });
});

describe("itens", () => {
  it("valida afastamento e pedido", () => {
    expect(colunasDoItemTrabalhista("afastamento", { inicio: "2024-01-10", fim: "2024-03-01" })).toEqual({ inicio: "2024-01-10", fim: "2024-03-01", especie: "auxilio_doenca", observacao: null });
    expect(() => colunasDoItemTrabalhista("afastamento", { inicio: "2024-03-10", fim: "2024-03-01" })).toThrow(/anterior/);
    expect(colunasDoItemTrabalhista("pedido", { pedido: " Adicional de insalubridade ", valor_pedido: "12.345,67", resultado_sentenca: "deferido" })).toMatchObject({
      pedido: "Adicional de insalubridade",
      valor_pedido: 12345.67,
      resultado_sentenca: "deferido",
      resultado_acordao: null,
    });
    expect(() => colunasDoItemTrabalhista("pedido", { pedido: "x", resultado_rr: "talvez" })).toThrow();
  });

  it("descreve para o histórico", () => {
    expect(descreverItemTrabalhista("afastamento", { inicio: "2024-01-10", fim: null, especie: "acidentario" })).toBe("Auxílio-doença acidentário (B91): 10/01/2024 a em curso");
    expect(descreverItemTrabalhista("pedido", { pedido: "Horas extras", valor_pedido: null, resultado_sentenca: "indeferido", resultado_acordao: "em_parte" })).toBe(
      "Horas extras — sentença: indeferido; acórdão: deferido em parte"
    );
  });

  it("o resultado que vale é o da última decisão que julgou", () => {
    expect(resultadoFinal({ resultadoSentenca: "deferido", resultadoAcordao: "indeferido", resultadoRr: "nao_julgado" })).toBe("indeferido");
    expect(resultadoFinal({ resultadoSentenca: "deferido", resultadoAcordao: null, resultadoRr: null })).toBe("deferido");
    expect(resultadoFinal({ resultadoSentenca: null, resultadoAcordao: null, resultadoRr: null })).toBeNull();
  });
});

describe("saneamento trabalhista", () => {
  const reclamante = parte({ id: "r", polo: "ativo", nome: "Reclamante Exemplo" });
  const advogado = parte({ id: "a", polo: "ativo", papel: "advogado", nome: "Advogada Exemplo", oab: "SP 123.456", referenteA: "r", contatos: [{ tipo: "email", valor: "Adv@Exemplo.com.br", whatsapp: false, observacao: null }] });
  const empresa = parte({ id: "e", polo: "passivo", nome: "Empresa Exemplo Ltda" });

  it("acha os advogados do reclamante pelo polo oposto ao do cliente", () => {
    expect(advogadosDoReclamante([reclamante, advogado, empresa], "Passivo").map((item) => item.id)).toEqual(["a"]);
    expect(advogadosDoReclamante([reclamante, advogado, empresa], "Ativo")).toEqual([]);
  });

  it("processo da área Trabalhista usa a lista própria; os demais, a da Rec. Crédito", () => {
    const valores = { area: "Trabalhista", cnj: "0000000-00.0000.5.15.0000", polo_cliente: "Passivo", tipo_termino: "sem_justa_causa", laudo_agente: "insalubridade" };
    const trabalhista = calcularPreenchimento(valores, [reclamante, advogado, empresa], [], { pedidos: 2 });
    const chaves = trabalhista.itens.map((item) => item.chave);
    expect(chaves).toContain("advogado_reclamante_email");
    expect(chaves).not.toContain("executado_enderecos");
    const estado = (chave: string) => trabalhista.itens.find((item) => item.chave === chave)?.estado;
    expect(estado("advogado_reclamante")).toBe("ok");
    expect(estado("advogado_reclamante_email")).toBe("ok");
    expect(estado("pedidos")).toBe("ok");
    expect(estado("ultimo_dia_trabalhado")).toBe("nao_se_aplica");
    expect(estado("data_admissao")).toBe("falta");

    const credito = calcularPreenchimento({ ...valores, area: "Recuperação de Crédito" }, [reclamante, empresa]);
    expect(credito.itens.map((item) => item.chave)).toContain("executado_enderecos");
  });
});
