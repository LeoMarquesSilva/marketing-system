import { describe, expect, it } from "vitest";
import { clienteNoTexto, pastaSugerida, verificacoesSemPasta } from "./controladoria";
import type { SugestaoTriagem } from "./sugestao-triagem";
import type { PastaSioe } from "./triagem";

function pasta(campos: Partial<PastaSioe>): PastaSioe {
  return {
    ci: "1",
    cnj: "0000000-00.2026.5.02.0000",
    vinculo: null,
    cliente: "Officer S. A. Distribuidora de Produtos de Tecnologia",
    grupoCliente: "Grupo Officer",
    area: "Trabalhista",
    advogadoResponsavel: null,
    situacao: "Ativo",
    etiquetas: null,
    ...campos,
  };
}

function sugestao(campos: Partial<SugestaoTriagem>): SugestaoTriagem {
  return {
    origem: "ia",
    escritorio: "Cível",
    grupo: null,
    demandaRisco: false,
    referencia: null,
    cliente: null,
    confianca: "baixa",
    motivo: "Não identifica o cliente.",
    geradaEm: "2026-10-29T10:00:00Z",
    ...campos,
  };
}

describe("pastaSugerida", () => {
  it("sugere a única pasta ativa, a do processo principal", () => {
    const principal = pasta({ ci: "41006", vinculo: "PROCESSO PRINCIPAL", situacao: "Ativo" });
    const resultado = pastaSugerida([
      pasta({ ci: "41007", vinculo: "RECURSO", situacao: "Arquivado definitivamente" }),
      principal,
      pasta({ ci: "41046", vinculo: "RECURSO", situacao: "Arquivado definitivamente" }),
    ]);
    expect(resultado?.pasta.ci).toBe("41006");
    expect(resultado?.motivo).toMatch(/processo principal/);
  });

  it("entre várias ativas fica com a principal; sem escolha clara, null", () => {
    expect(
      pastaSugerida([pasta({ ci: "1", vinculo: "RECURSO" }), pasta({ ci: "2", vinculo: "PROCESSO PRINCIPAL" })])?.pasta.ci
    ).toBe("2");
    expect(pastaSugerida([pasta({ ci: "1", vinculo: "RECURSO" }), pasta({ ci: "2", vinculo: "RECURSO" })])).toBeNull();
    expect(pastaSugerida([pasta({ ci: "1" })])).toBeNull();
  });
});

describe("clienteNoTexto", () => {
  it("acha o cliente sem o tipo societário e sem acento", () => {
    const texto = "RECLAMADO: OFFICER S/A DISTRIBUIDORA DE PRODUTOS DE TECNOLOGIA - EM RECUPERAÇÃO JUDICIAL";
    expect(clienteNoTexto(pasta({}), texto)).toBe(true);
    expect(clienteNoTexto(pasta({ cliente: "Macan Logistica e Transportes Ltda" }), texto)).toBe(false);
  });
});

describe("verificacoesSemPasta", () => {
  const base = { teor: "Processo 0000001-00.2026.5.02.0001. Vistos.", numeroProcesso: "0000001-00.2026.5.02.0001" };

  it("processo citado com pasta: as partes nem chegam a ser procuradas", () => {
    const passos = verificacoesSemPasta({
      ...base,
      teor: `${base.teor} Apenso ao 1234567-89.2020.8.26.0100.`,
      sugestaoTriagem: sugestao({
        origem: "numero",
        confianca: "alta",
        referencia: { ci: "5000", cnj: "12345678920208260100", cliente: "Cliente X", grupo: "Grupo X" },
      }),
    });
    expect(passos.map((passo) => passo.situacao)).toEqual(["nada", "achou", "nao_verificado", "nao_verificado"]);
    expect(passos[1].detalhe).toBe("1234567-89.2020.8.26.0100 tem a pasta CI 5000 (Grupo X · Cliente X).");
  });

  it("só a IA: número e partes sem nada, e o texto cita outro processo sem pasta", () => {
    const passos = verificacoesSemPasta({
      ...base,
      teor: `${base.teor} Ver 1234567-89.2020.8.26.0100.`,
      sugestaoTriagem: sugestao({ grupo: "Grupo Y" }),
    });
    expect(passos.map((passo) => passo.situacao)).toEqual(["nada", "nada", "nada", "achou"]);
    expect(passos[1].detalhe).toBe("Cita 1234567-89.2020.8.26.0100, sem pasta no VIOS.");
    expect(passos[3].detalhe).toBe("Não identifica o cliente.");
  });

  it("parte cliente achada", () => {
    const passos = verificacoesSemPasta({
      ...base,
      sugestaoTriagem: sugestao({ origem: "parte", cliente: "Macan Ltda", referencia: { ci: "37187", cnj: "x", cliente: null, grupo: "Grupo Macan" } }),
    });
    expect(passos[2]).toMatchObject({ situacao: "achou", detalhe: "Macan Ltda é cliente (Grupo Macan, CI 37187)." });
  });
});
