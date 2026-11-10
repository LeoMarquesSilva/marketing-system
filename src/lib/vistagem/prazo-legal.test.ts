import { describe, expect, it } from "vitest";
import { contagemPadraoDaArea } from "./agendamento";
import { criarCalendarioDePrazo } from "./dias-uteis";
import { montarFluxo, type TipoNaArvore } from "./fluxo-vios";
import { fataisDoFluxo, prazoLegalDaTarefa } from "./prazo-legal";

describe("prazoLegalDaTarefa", () => {
  it("usa o CPC fora do Trabalhista", () => {
    expect(prazoLegalDaTarefa("APELAÇÃO", "Cível")).toBe(15);
    expect(prazoLegalDaTarefa("Agravo de Instrumento", "Insolvência")).toBe(15);
    expect(prazoLegalDaTarefa("EMBARGOS DE DECLARAÇÃO", "Cível | Insolvência")).toBe(5);
    expect(prazoLegalDaTarefa("RECURSO INOMINADO", "Cível")).toBe(10);
  });

  it("usa 8 dias nos recursos trabalhistas, 5 nos embargos de declaração e 15 para o STF", () => {
    expect(prazoLegalDaTarefa("RECURSO ORDINÁRIO", "Trabalhista")).toBe(8);
    expect(prazoLegalDaTarefa("RECURSO DE REVISTA", "TRABALHISTA")).toBe(8);
    expect(prazoLegalDaTarefa("AGRAVO DE PETIÇÃO", "Trabalhista")).toBe(8);
    expect(prazoLegalDaTarefa("CONTRARRAZÕES", "Trabalhista")).toBe(8);
    expect(prazoLegalDaTarefa("EMBARGOS DE DECLARAÇÃO", "Trabalhista")).toBe(5);
    expect(prazoLegalDaTarefa("RECURSO ESPECIAL/EXTRAORDINÁRIO", "Trabalhista")).toBe(15);
  });

  it("reconhece as Apelações com o nome novo do VIOS (36 com embargos, 486 sem)", () => {
    expect(prazoLegalDaTarefa("APELAÇÃO - COM EMBARGOS", "Cível")).toBe(15);
    expect(prazoLegalDaTarefa("APELAÇÃO - SEM EMBARGOS", "Insolvência")).toBe(15);
    expect(prazoLegalDaTarefa("Apelacao - sem embargos", "Tributário")).toBe(15);
  });

  it("devolve null quando a tarefa não é recurso", () => {
    expect(prazoLegalDaTarefa("CONTESTAÇÃO", "Cível")).toBeNull();
    expect(prazoLegalDaTarefa("MANIFESTAÇÃO SOBRE LAUDO PERICIAL", "Trabalhista")).toBeNull();
    expect(prazoLegalDaTarefa("", "Cível")).toBeNull();
  });
});

describe("fataisDoFluxo", () => {
  // SENTENÇA (13) como na árvore do VIOS: Ciência e Informar Cliente, sem Protocolar; Embargos e Recurso Ordinário, com.
  const ARVORE = new Map<number, TipoNaArvore>([
    [13, { nome: "SENTENÇA", prazo: null, criacao: [321, 414, 450, 153, 900], conclusao: [] }],
    [321, { nome: "1. CIÊNCIA DOS AGENDAMENTOS", prazo: null, criacao: [], conclusao: [] }],
    [414, { nome: "INFORMAR CLIENTE + INTERESSE RECURSAL + GUIA", prazo: "1 dia", criacao: [], conclusao: [] }],
    [450, { nome: "EMBARGOS DE DECLARAÇÃO", prazo: null, criacao: [314, 313], conclusao: [] }],
    [153, { nome: "RECURSO ORDINÁRIO", prazo: "5 dias", criacao: [314, 313], conclusao: [] }],
    [900, { nome: "OUTRA PETIÇÃO SEM PRAZO LEGAL", prazo: null, criacao: [314, 313], conclusao: [] }],
    [314, { nome: "2. REVISAR", prazo: "1 dia", criacao: [], conclusao: [] }],
    [313, { nome: "3. PROTOCOLAR", prazo: "2 dias", criacao: [], conclusao: [] }],
  ]);
  const SENTENCA = montarFluxo("13", ARVORE);
  const conta = criarCalendarioDePrazo([]);

  it("na SENTENÇA trabalhista, a fatal dos Embargos (5 dias) e a do Recurso Ordinário (8 dias)", () => {
    expect(fataisDoFluxo(SENTENCA, "2026-11-09", "Trabalhista", "uteis", conta)).toEqual([
      { nome: "EMBARGOS DE DECLARAÇÃO", dias: 5, data: "2026-11-16" },
      { nome: "RECURSO ORDINÁRIO", dias: 8, data: "2026-11-19" },
    ]);
  });

  it("conta os feriados e o recesso, como a fatal da tela", () => {
    expect(fataisDoFluxo(SENTENCA, "2026-11-09", "Trabalhista", "uteis", criarCalendarioDePrazo(["2026-11-16"]))).toEqual([
      { nome: "EMBARGOS DE DECLARAÇÃO", dias: 5, data: "2026-11-17" },
      { nome: "RECURSO ORDINÁRIO", dias: 8, data: "2026-11-20" },
    ]);
    expect(fataisDoFluxo(SENTENCA, "2026-12-16", "Trabalhista", "uteis", conta).map((fatal) => fatal.data)).toEqual(["2027-01-25", "2027-01-28"]);
  });

  it("não inventa fatal: sem o fluxo, sem a publicação ou sem o prazo legal, fica de fora", () => {
    expect(fataisDoFluxo(null, "2026-11-09", "Trabalhista", "uteis", conta)).toEqual([]);
    expect(fataisDoFluxo(SENTENCA, null, "Trabalhista", "uteis", conta)).toEqual([]);
    const nomes = fataisDoFluxo(SENTENCA, "2026-11-09", "Trabalhista", "uteis", conta).map((fatal) => fatal.nome);
    expect(nomes).not.toContain("OUTRA PETIÇÃO SEM PRAZO LEGAL");
    expect(nomes).not.toContain("INFORMAR CLIENTE + INTERESSE RECURSAL + GUIA");
  });
});

describe("contagemPadraoDaArea", () => {
  it("marca Corridos só na Insolvência", () => {
    expect(contagemPadraoDaArea("Insolvência")).toBe("corridos");
    expect(contagemPadraoDaArea("INSOLVENCIA")).toBe("corridos");
    expect(contagemPadraoDaArea("Cível | Insolvência")).toBe("uteis");
    expect(contagemPadraoDaArea("Trabalhista")).toBe("uteis");
    expect(contagemPadraoDaArea(null)).toBe("uteis");
  });
});
