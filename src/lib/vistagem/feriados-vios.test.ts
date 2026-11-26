import { describe, expect, it } from "vitest";
import { diasSemTarefaNoVios, nomesDosDiasSemTarefaNoVios, ondeEstaOProcesso, type FeriadoDoVios } from "./feriados-vios";

// Como estão na tabela de feriados do VIOS em 25/11/2026.
const feriado = (f: Partial<FeriadoDoVios> & Pick<FeriadoDoVios, "id" | "dataInicio">): FeriadoDoVios => ({
  dataFim: f.dataInicio,
  nome: null,
  postergaProcessuais: true,
  jurisdicoes: null,
  estados: null,
  ...f,
});
const CARNAVAL = feriado({ id: 430, dataInicio: "2027-02-08", dataFim: "2027-02-09", nome: "Carnaval" });
const DIA_DA_JUSTICA = feriado({ id: 435, dataInicio: "2027-12-08", nome: "Dia da Justiça", jurisdicoes: ["PRIMEIRO GRAU", "SEGUNDO GRAU"], estados: ["São Paulo"] });
const SEMANA_SANTA = feriado({ id: 389, dataInicio: "2025-04-17", nome: "Semana Santa", jurisdicoes: ["STF", "STJ", "TST"] });
const CORPUS_MENOS_MG = feriado({ id: 391, dataInicio: "2025-06-19", nome: "Corpus Christi", estados: ["Acre", "São Paulo", "Rorâima"] });
const NAO_POSTERGA = feriado({ id: 47, dataInicio: "2026-04-21", nome: "Tiradentes", postergaProcessuais: false });
// No VIOS o Recesso de 2027 está de 20/12/2027 a 06/01/2027 (fim antes do início).
const RECESSO_ERRADO = feriado({ id: 396, dataInicio: "2027-12-20", dataFim: "2027-01-06", nome: "Recesso Foresen" });
const TODOS = [CARNAVAL, DIA_DA_JUSTICA, SEMANA_SANTA, CORPUS_MENOS_MG, NAO_POSTERGA, RECESSO_ERRADO];

describe("ondeEstaOProcesso", () => {
  it("UF e tribunal da publicação viram estado e jurisdição do VIOS", () => {
    expect(ondeEstaOProcesso({ estado: "SP", tribunal: "TJSP" })).toEqual({ estados: ["São Paulo"], jurisdicoes: ["PRIMEIRO GRAU", "SEGUNDO GRAU"] });
    expect(ondeEstaOProcesso({ estado: "AC/RO", tribunal: "TRT14" })).toEqual({ estados: ["Acre", "Rondônia"], jurisdicoes: ["PRIMEIRO GRAU", "SEGUNDO GRAU"] });
    // Superiores: a jurisdição é o próprio tribunal; "BR" não diz o estado.
    expect(ondeEstaOProcesso({ estado: "BR", tribunal: "TST" })).toEqual({ estados: null, jurisdicoes: ["TST"] });
    expect(ondeEstaOProcesso({ estado: null, tribunal: null })).toEqual({ estados: null, jurisdicoes: null });
  });
});

describe("diasSemTarefaNoVios", () => {
  it("processo do TJSP: Carnaval, Dia da Justiça de SP e Corpus Christi; não a Semana Santa dos superiores", () => {
    expect(diasSemTarefaNoVios(TODOS, ondeEstaOProcesso({ estado: "SP", tribunal: "TJSP" }))).toEqual([
      "2025-06-19",
      "2027-02-08",
      "2027-02-09",
      "2027-12-08",
      "2027-12-20",
    ]);
  });

  it("processo de MG: sem o Dia da Justiça de SP e sem o Corpus Christi em que MG trabalha", () => {
    expect(diasSemTarefaNoVios(TODOS, ondeEstaOProcesso({ estado: "MG", tribunal: "TJMG" }))).toEqual(["2027-02-08", "2027-02-09", "2027-12-20"]);
  });

  it("processo no TST: Semana Santa dos superiores, sem o Dia da Justiça de 1º e 2º grau", () => {
    expect(diasSemTarefaNoVios(TODOS, ondeEstaOProcesso({ estado: "BR", tribunal: "TST" }))).toEqual([
      "2025-04-17",
      "2025-06-19",
      "2027-02-08",
      "2027-02-09",
      "2027-12-20",
    ]);
  });

  it("sem saber onde o processo está, todo feriado que posterga vale (lado seguro)", () => {
    expect(diasSemTarefaNoVios(TODOS, ondeEstaOProcesso({}))).toEqual(["2025-04-17", "2025-06-19", "2027-02-08", "2027-02-09", "2027-12-08", "2027-12-20"]);
  });

  it("Roraima casa com o 'Rorâima' do VIOS", () => {
    expect(diasSemTarefaNoVios([CORPUS_MENOS_MG], ondeEstaOProcesso({ estado: "RR", tribunal: "TJRR" }))).toEqual(["2025-06-19"]);
  });
});

describe("nomesDosDiasSemTarefaNoVios", () => {
  it("dá o nome do feriado por dia; o mesmo nome repetido aparece uma vez", () => {
    const repetido = feriado({ id: 445, dataInicio: "2027-12-07", dataFim: "2027-12-08", nome: "Dia da Justiça", jurisdicoes: ["PRIMEIRO GRAU"], estados: ["São Paulo"] });
    const nomes = nomesDosDiasSemTarefaNoVios([CARNAVAL, DIA_DA_JUSTICA, repetido], ondeEstaOProcesso({ estado: "SP", tribunal: "TJSP" }));
    expect(nomes).toEqual({ "2027-02-08": "Carnaval", "2027-02-09": "Carnaval", "2027-12-07": "Dia da Justiça", "2027-12-08": "Dia da Justiça" });
    // Em MG, o Dia da Justiça de SP não aparece.
    expect(nomesDosDiasSemTarefaNoVios([DIA_DA_JUSTICA], ondeEstaOProcesso({ estado: "MG", tribunal: "TJMG" }))).toEqual({});
  });
});
