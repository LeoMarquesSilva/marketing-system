import { describe, expect, it } from "vitest";
import { cienciaDosAgendamentos, ehCienciaDosAgendamentos, fluxoCriaCiencia, type TarefaParaCiencia } from "./ciencia-agendamentos";
import type { FluxoDaTarefa, TarefaDoFluxo } from "./fluxo-vios";

function noFluxo(nome: string, filhas: TarefaDoFluxo[] = []): TarefaDoFluxo {
  return { id: nome, nome, prazo: null, papel: "responsavel", tambemCria: [], aoConcluir: [], regra: null, filhas };
}

const FLUXOS: Record<string, FluxoDaTarefa> = {
  // Agravo de Petição: cria a Ciência junto.
  "155": { criacao: [noFluxo("1. CIÊNCIA DOS AGENDAMENTOS"), noFluxo("2. REVISAR"), noFluxo("3. PROTOCOLAR")], conclusao: [] },
  // Sessão de Julgamento: cria outras, sem a Ciência.
  "406": { criacao: [noFluxo("INFORMAR CLIENTE")], conclusao: [] },
  // Ciência só dentro de uma filha (fluxo dentro do fluxo).
  "202": { criacao: [noFluxo("CONTESTAÇÃO", [noFluxo("1. CIÊNCIA DOS AGENDAMENTOS")])], conclusao: [] },
};
const fluxoDe = (id: string) => FLUXOS[id] ?? null;

const ADVOGADA = { id: "100", nome: "Advogada Exemplo" };
const ESTAGIARIA = { id: "298", nome: "Estagiária Exemplo" };
const REVISOR = { id: "200", nome: "Revisor Exemplo" };

function tarefa(nome: string, tarefaId: string | null, extra: Partial<TarefaParaCiencia> = {}): TarefaParaCiencia {
  return { tarefa: nome, tarefaId, responsaveis: [ADVOGADA], revisor: REVISOR, ...extra };
}

const opcoes = (area: string) => ({ fluxoDe, area, ehEstagiario: (pessoa: { id: string | null }) => pessoa.id === ESTAGIARIA.id });

describe("ehCienciaDosAgendamentos / fluxoCriaCiencia", () => {
  it("reconhece o tipo pelo nome, com ou sem o número e os acentos", () => {
    expect(ehCienciaDosAgendamentos("1. CIÊNCIA DOS AGENDAMENTOS")).toBe(true);
    expect(ehCienciaDosAgendamentos("ciencia dos agendamentos")).toBe(true);
    expect(ehCienciaDosAgendamentos("CIÊNCIA NF")).toBe(false);
  });

  it("procura a Ciência em qualquer nível do que o fluxo cria junto", () => {
    expect(fluxoCriaCiencia(FLUXOS["155"])).toBe(true);
    expect(fluxoCriaCiencia(FLUXOS["202"])).toBe(true);
    expect(fluxoCriaCiencia(FLUXOS["406"])).toBe(false);
    expect(fluxoCriaCiencia(null)).toBe(false);
  });
});

describe("cienciaDosAgendamentos", () => {
  it("não cria quando o fluxo de alguma tarefa já cria a Ciência", () => {
    expect(cienciaDosAgendamentos([tarefa("SESSÃO DE JULGAMENTO", "406"), tarefa("AGRAVO DE PETIÇÃO", "155")], opcoes("Trabalhista"))).toBeNull();
  });

  it("não cria quando o jurídico já agendou a Ciência", () => {
    expect(cienciaDosAgendamentos([tarefa("CIÊNCIA NF", "9"), tarefa("1. CIÊNCIA DOS AGENDAMENTOS", "321")], opcoes("Trabalhista"))).toBeNull();
  });

  it("cria para quem faz o Enviar da primeira tarefa (tipo sem fluxo, como a Ciência NF)", () => {
    const outra = { id: "300", nome: "Outra Advogada" };
    const resultado = cienciaDosAgendamentos(
      [tarefa("CIÊNCIA NF", "9"), tarefa("SESSÃO DE JULGAMENTO", "406", { responsaveis: [outra] })],
      opcoes("Trabalhista")
    );
    expect(resultado).toEqual({ responsaveis: [ADVOGADA], revisorNoLugarDe: [] });
  });

  it("fora da Reestruturação, o estagiário continua com a Ciência", () => {
    const resultado = cienciaDosAgendamentos([tarefa("CIÊNCIA NF", "9", { responsaveis: [ESTAGIARIA] })], opcoes("Trabalhista"));
    expect(resultado?.responsaveis).toEqual([ESTAGIARIA]);
  });

  it("na Reestruturação, o estagiário dá lugar ao revisor", () => {
    for (const area of ["Insolvência", "Cível | Insolvência"]) {
      const resultado = cienciaDosAgendamentos([tarefa("CIÊNCIA NF", "9", { responsaveis: [ESTAGIARIA, ADVOGADA] })], opcoes(area));
      expect(resultado).toEqual({ responsaveis: [REVISOR, ADVOGADA], revisorNoLugarDe: [ESTAGIARIA.nome] });
    }
  });

  it("sem revisor na primeira tarefa, usa o de outra tarefa; sem nenhum, fica com o estagiário", () => {
    const semRevisor = cienciaDosAgendamentos(
      [tarefa("CIÊNCIA NF", "9", { responsaveis: [ESTAGIARIA], revisor: null }), tarefa("SESSÃO DE JULGAMENTO", "406")],
      opcoes("Insolvência")
    );
    expect(semRevisor?.responsaveis).toEqual([REVISOR]);
    const nenhum = cienciaDosAgendamentos([tarefa("CIÊNCIA NF", "9", { responsaveis: [ESTAGIARIA], revisor: null })], opcoes("Insolvência"));
    expect(nenhum).toEqual({ responsaveis: [ESTAGIARIA], revisorNoLugarDe: [] });
  });

  it("não repete a pessoa quando o revisor já é responsável", () => {
    const resultado = cienciaDosAgendamentos([tarefa("CIÊNCIA NF", "9", { responsaveis: [ESTAGIARIA, REVISOR] })], opcoes("Insolvência"));
    expect(resultado?.responsaveis).toEqual([REVISOR]);
  });

  it("sem tarefa escolhida ou sem responsável, ainda não há o que criar", () => {
    expect(cienciaDosAgendamentos([], opcoes("Trabalhista"))).toBeNull();
    expect(cienciaDosAgendamentos([tarefa("", null)], opcoes("Trabalhista"))).toBeNull();
    expect(cienciaDosAgendamentos([tarefa("CIÊNCIA NF", "9", { responsaveis: [] })], opcoes("Trabalhista"))).toBeNull();
  });
});
