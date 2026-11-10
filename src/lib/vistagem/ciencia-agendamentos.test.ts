import { describe, expect, it } from "vitest";
import { cienciaDosAgendamentos, cienciaQueFica, ehCienciaDosAgendamentos, fluxoCriaCiencia, type TarefaParaCiencia } from "./ciencia-agendamentos";
import type { FluxoDaTarefa, TarefaDoFluxo } from "./fluxo-vios";

function noFluxo(nome: string, filhas: TarefaDoFluxo[] = []): TarefaDoFluxo {
  return { id: nome, nome, prazo: null, papel: "responsavel", tambemCria: [], aoConcluir: [], regra: null, responsabilidade: null, filhas };
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

describe("cienciaQueFica (uma Ciência só por vistagem)", () => {
  const ciencia = () => noFluxo("1. CIÊNCIA DOS AGENDAMENTOS");
  // Apelação: o Embargos (com a Ciência dele) vem antes, na ordem do fluxo, da Ciência da própria Apelação.
  const apelacao: FluxoDaTarefa = { criacao: [noFluxo("2. REVISAR"), noFluxo("EMBARGOS DE DECLARAÇÃO", [ciencia()]), ciencia()], conclusao: [] };

  it("no fluxo de uma tarefa, fica a mais perto dela", () => {
    expect(cienciaQueFica([{ chave: 1, nome: "APELAÇÃO", fluxo: apelacao }])).toEqual({ chave: 1, caminho: ["1. CIÊNCIA DOS AGENDAMENTOS"] });
  });

  it("entre as tarefas, fica a da primeira incluída que cria (ou é) a Ciência", () => {
    expect(
      cienciaQueFica([
        { chave: "a", nome: "INFORMAR CLIENTE", fluxo: null },
        { chave: "b", nome: "CONTESTAÇÃO", fluxo: FLUXOS["202"] },
        { chave: "c", nome: "APELAÇÃO", fluxo: apelacao },
      ])
    ).toEqual({ chave: "b", caminho: ["CONTESTAÇÃO", "1. CIÊNCIA DOS AGENDAMENTOS"] });
    expect(cienciaQueFica([{ chave: "a", nome: "1. CIÊNCIA DOS AGENDAMENTOS", fluxo: null }, { chave: "b", nome: "APELAÇÃO", fluxo: apelacao }])).toEqual({
      chave: "a",
      caminho: null,
    });
    expect(cienciaQueFica([{ chave: "a", nome: "INFORMAR CLIENTE", fluxo: FLUXOS["406"] }])).toBeNull();
  });
});

describe("cienciaDosAgendamentos", () => {
  it("Sessão de Julgamento, como a CIÊNCIA NF, não pede a Ciência (nem escolhe o responsável)", () => {
    expect(cienciaDosAgendamentos([tarefa("SESSÃO DE JULGAMENTO", "406")], opcoes("Cível"))).toBeNull();
    expect(cienciaDosAgendamentos([tarefa("Sessão de Julgamento", null), tarefa("CIÊNCIA NF", "796")], opcoes("Cível"))).toBeNull();
    const outra = { id: "300", nome: "Outra Advogada" };
    expect(
      cienciaDosAgendamentos([tarefa("SESSÃO DE JULGAMENTO", "406"), tarefa("INFORMAR CLIENTE", "412", { responsaveis: [outra] })], opcoes("Cível"))
    ).toEqual({ responsaveis: [outra], revisorNoLugarDe: [] });
  });

  it("não cria quando o fluxo de alguma tarefa já cria a Ciência", () => {
    expect(cienciaDosAgendamentos([tarefa("SESSÃO DE JULGAMENTO", "406"), tarefa("AGRAVO DE PETIÇÃO", "155")], opcoes("Trabalhista"))).toBeNull();
  });

  it("não cria quando o jurídico já agendou a Ciência", () => {
    expect(cienciaDosAgendamentos([tarefa("CIÊNCIA NF", "9"), tarefa("1. CIÊNCIA DOS AGENDAMENTOS", "321")], opcoes("Trabalhista"))).toBeNull();
  });

  it("cria para quem faz o Enviar da primeira tarefa (tipo sem fluxo, como o Informar Cliente)", () => {
    const outra = { id: "300", nome: "Outra Advogada" };
    const resultado = cienciaDosAgendamentos(
      [tarefa("INFORMAR CLIENTE", "414"), tarefa("SESSÃO DE JULGAMENTO", "406", { responsaveis: [outra] })],
      opcoes("Trabalhista")
    );
    expect(resultado).toEqual({ responsaveis: [ADVOGADA], revisorNoLugarDe: [] });
  });

  it("fora da Reestruturação, o estagiário continua com a Ciência", () => {
    const resultado = cienciaDosAgendamentos([tarefa("INFORMAR CLIENTE", "414", { responsaveis: [ESTAGIARIA] })], opcoes("Trabalhista"));
    expect(resultado?.responsaveis).toEqual([ESTAGIARIA]);
  });

  it("na Reestruturação, o estagiário dá lugar ao revisor", () => {
    for (const area of ["Insolvência", "Cível | Insolvência"]) {
      const resultado = cienciaDosAgendamentos([tarefa("INFORMAR CLIENTE", "414", { responsaveis: [ESTAGIARIA, ADVOGADA] })], opcoes(area));
      expect(resultado).toEqual({ responsaveis: [REVISOR, ADVOGADA], revisorNoLugarDe: [ESTAGIARIA.nome] });
    }
  });

  it("sem revisor na primeira tarefa, usa o de outra tarefa; sem nenhum, fica com o estagiário", () => {
    const semRevisor = cienciaDosAgendamentos(
      [tarefa("INFORMAR CLIENTE", "414", { responsaveis: [ESTAGIARIA], revisor: null }), tarefa("MANIFESTAÇÃO SOBRE LAUDO PERICIAL", "433")],
      opcoes("Insolvência")
    );
    expect(semRevisor?.responsaveis).toEqual([REVISOR]);
    const nenhum = cienciaDosAgendamentos([tarefa("INFORMAR CLIENTE", "414", { responsaveis: [ESTAGIARIA], revisor: null })], opcoes("Insolvência"));
    expect(nenhum).toEqual({ responsaveis: [ESTAGIARIA], revisorNoLugarDe: [] });
  });

  it("não repete a pessoa quando o revisor já é responsável", () => {
    const resultado = cienciaDosAgendamentos([tarefa("INFORMAR CLIENTE", "414", { responsaveis: [ESTAGIARIA, REVISOR] })], opcoes("Insolvência"));
    expect(resultado?.responsaveis).toEqual([REVISOR]);
  });

  it("vistagem só com CIÊNCIA NF não leva a Ciência dos Agendamentos", () => {
    expect(cienciaDosAgendamentos([tarefa("CIÊNCIA NF", "9")], opcoes("Trabalhista"))).toBeNull();
    expect(cienciaDosAgendamentos([tarefa("CIÊNCIA NF", "9"), tarefa("CIÊNCIA NF", "9")], opcoes("Insolvência"))).toBeNull();
  });

  it("VERIFICAR RENÚNCIA, como a CIÊNCIA NF, não pede a Ciência (nem escolhe o responsável)", () => {
    expect(cienciaDosAgendamentos([tarefa("VERIFICAR RENÚNCIA", "320")], opcoes("Cível"))).toBeNull();
    expect(cienciaDosAgendamentos([tarefa("Verificar Renuncia", "320"), tarefa("CIÊNCIA NF", "796")], opcoes("Recuperação de Crédito"))).toBeNull();
    const outra = { id: "300", nome: "Outra Advogada" };
    expect(
      cienciaDosAgendamentos([tarefa("VERIFICAR RENÚNCIA", "320"), tarefa("INFORMAR CLIENTE", "414", { responsaveis: [outra] })], opcoes("Cível"))
    ).toEqual({ responsaveis: [outra], revisorNoLugarDe: [] });
    // As outras de renúncia continuam pedindo a Ciência.
    expect(cienciaDosAgendamentos([tarefa("RENÚNCIA", "736")], opcoes("Cível"))).toEqual({ responsaveis: [ADVOGADA], revisorNoLugarDe: [] });
  });

  it("com CIÊNCIA NF e outra tarefa, a Ciência vai para quem faz o Enviar da outra", () => {
    const outra = { id: "300", nome: "Outra Advogada" };
    const resultado = cienciaDosAgendamentos(
      [tarefa("CIÊNCIA NF", "9"), tarefa("MANIFESTAÇÃO SOBRE LAUDO PERICIAL", "433", { responsaveis: [outra] })],
      opcoes("Trabalhista")
    );
    expect(resultado).toEqual({ responsaveis: [outra], revisorNoLugarDe: [] });
  });

  it("sem tarefa escolhida ou sem responsável, ainda não há o que criar", () => {
    expect(cienciaDosAgendamentos([], opcoes("Trabalhista"))).toBeNull();
    expect(cienciaDosAgendamentos([tarefa("", null)], opcoes("Trabalhista"))).toBeNull();
    expect(cienciaDosAgendamentos([tarefa("INFORMAR CLIENTE", "414", { responsaveis: [] })], opcoes("Trabalhista"))).toBeNull();
  });
});
