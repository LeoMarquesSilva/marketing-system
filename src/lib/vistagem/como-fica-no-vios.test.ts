import { describe, expect, it } from "vitest";
import { agendaNoVios, nomeCurto, partesDaData } from "./como-fica-no-vios";
import type { AgendamentoResumo, TarefaPrevista } from "./types";

function agendamento(campos: Partial<AgendamentoResumo>): AgendamentoResumo {
  return {
    id: "a1",
    ordem: 1,
    etiqueta: "COMPROMISSO",
    tarefa: "LEILÃO",
    tarefaId: "10",
    data: "2027-02-16",
    dataFatal: null,
    diasPrazo: null,
    contagemPrazo: null,
    hora: "10:27",
    horaFim: null,
    dataLimite: null,
    responsavel: "Manoela Brisighello Angotti",
    revisor: null,
    observacao: null,
    viosTarefas: null,
    fluxoDatas: [],
    envioStatus: "nao_enviado",
    envioSimulado: null,
    viosTarefaId: null,
    envioErro: null,
    enviadoEm: null,
    ...campos,
  };
}

function prevista(campos: Partial<TarefaPrevista>): TarefaPrevista {
  return {
    nome: "1. CIÊNCIA DOS AGENDAMENTOS",
    caminho: ["1. CIÊNCIA DOS AGENDAMENTOS"],
    nivel: 1,
    data: "2026-11-04",
    dataVios: "2026-11-04",
    editada: false,
    responsaveis: "Manoela Brisighello Angotti",
    quando: "criacao",
    ...campos,
  };
}

describe("agendaNoVios", () => {
  it("antes do robô: a tarefa pedida e as do fluxo em ordem de data, com quem cria cada uma", () => {
    const agenda = agendaNoVios(
      agendamento({
        fluxoPrevisto: [
          prevista({}),
          prevista({ nome: "INSERIR PAUTA + ATUALIZAR SISTEMA", caminho: ["INSERIR PAUTA + ATUALIZAR SISTEMA"], data: "2026-11-05" }),
          prevista({ nome: "2. REVISAR", caminho: ["EMBARGOS", "2. REVISAR"], nivel: 2, data: "2026-11-10" }),
          prevista({ nome: "CONCLUIR", caminho: ["CONCLUIR"], quando: "conclusao", data: null }),
        ],
      })
    );
    expect(agenda.gravada).toBe(false);
    expect(agenda.linhas.map((linha) => [linha.nome, linha.data, linha.principal, linha.criadaPor])).toEqual([
      ["1. CIÊNCIA DOS AGENDAMENTOS", "2026-11-04", false, null],
      ["INSERIR PAUTA + ATUALIZAR SISTEMA", "2026-11-05", false, null],
      ["2. REVISAR", "2026-11-10", false, "EMBARGOS"],
      ["LEILÃO", "2027-02-16", true, null],
    ]);
    expect(agenda.linhas.at(-1)?.hora).toBe("10:27");
    expect(agenda.aoConcluir).toEqual(["CONCLUIR"]);
  });

  it("antes do robô: na Sessão de Julgamento, o revisor aparece na tarefa, junto com o responsável", () => {
    const pedida = (campos: Partial<AgendamentoResumo>) => agendaNoVios(agendamento(campos)).linhas.find((linha) => linha.principal)?.responsaveis;
    expect(pedida({ tarefa: "SESSÃO DE JULGAMENTO", responsavel: "Lorena Miranda", revisor: "Vanessa Sellani" })).toBe("Lorena Miranda, Vanessa Sellani");
    expect(pedida({ tarefa: "SESSÃO DE JULGAMENTO", responsavel: "Lorena Miranda", revisor: "Lorena Miranda" })).toBe("Lorena Miranda");
    expect(pedida({ tarefa: "SESSÃO DE JULGAMENTO", responsavel: "Lorena Miranda", revisor: null })).toBe("Lorena Miranda");
    expect(pedida({ tarefa: "AUDIÊNCIA UNA/INICIAL", responsavel: "Lorena Miranda", revisor: "Vanessa Sellani" })).toBe("Lorena Miranda");
  });

  it("depois do robô: as tarefas gravadas, com o CI, e a pedida com o nome da vistagem", () => {
    const agenda = agendaNoVios(
      agendamento({
        viosTarefas: [
          { ci: "900", tipo: "Compromisso", principal: true, data: "2027-02-16", dataLimite: null, hora: "10:27", responsaveis: "Manoela" },
          { ci: "901", tipo: "1. CIÊNCIA DOS AGENDAMENTOS", principal: false, data: "2026-11-04", dataLimite: null, hora: null, responsaveis: "Manoela" },
        ],
      })
    );
    expect(agenda.gravada).toBe(true);
    expect(agenda.linhas.map((linha) => [linha.nome, linha.ci])).toEqual([
      ["1. CIÊNCIA DOS AGENDAMENTOS", "901"],
      ["LEILÃO", "900"],
    ]);
  });

  it("sem data vai para o fim e, no mesmo dia, a pedida vem antes", () => {
    const agenda = agendaNoVios(
      agendamento({ data: "2026-11-04", fluxoPrevisto: [prevista({ data: null }), prevista({ nome: "MESMO DIA", caminho: ["MESMO DIA"] })] })
    );
    expect(agenda.linhas.map((linha) => linha.nome)).toEqual(["LEILÃO", "MESMO DIA", "1. CIÊNCIA DOS AGENDAMENTOS"]);
  });
});

describe("partesDaData e nomeCurto", () => {
  it("dia, mês e dia da semana do calendário", () => {
    expect(partesDaData("2027-02-16")).toEqual({ dia: "16", mes: "fev", semana: "ter", ano: "2027" });
    expect(partesDaData("2026-11-04")).toEqual({ dia: "04", mes: "nov", semana: "qua", ano: "2026" });
  });

  it("primeiro e último nome", () => {
    expect(nomeCurto("Manoela Brisighello Angotti")).toBe("Manoela Angotti");
    expect(nomeCurto("Letícia Souza")).toBe("Letícia Souza");
    expect(nomeCurto("  Ana  ")).toBe("Ana");
  });
});
