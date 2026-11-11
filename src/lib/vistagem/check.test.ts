import { describe, expect, it } from "vitest";
import {
  compararTarefa,
  descricaoSugerida,
  foiCheckAutomatico,
  notaDoCheckAutomatico,
  revisorEstaNaTarefa,
  situacaoDoCheck,
  subtipoSugerido,
  tiposDoItem,
} from "./check";
import type { TarefaNoVios } from "./fila-vios";
import type { AgendamentoResumo } from "./types";

function gravada(campos: Partial<TarefaNoVios>): TarefaNoVios {
  return {
    ci: "934633",
    tipo: "IMPUGNAÇÃO AO LAUDO",
    principal: true,
    data: "2026-11-09",
    dataLimite: "2026-11-09",
    hora: null,
    responsaveis: "Letícia Zamarion Julio",
    ...campos,
  };
}

function agendamento(campos: Partial<AgendamentoResumo>): AgendamentoResumo {
  return {
    id: "a1",
    ordem: 1,
    etiqueta: "PRAZO",
    tarefa: "IMPUGNAÇÃO AO LAUDO",
    tarefaId: "10",
    data: "2026-11-09",
    dataFatal: "2026-11-12",
    diasPrazo: 8,
    contagemPrazo: "uteis",
    origemPrazo: null,
    hora: null,
    horaFim: null,
    dataLimite: null,
    responsavel: "Letícia Zamarion Julio",
    revisor: "Pamela Klava Senna Patricio",
    observacao: null,
    viosTarefas: [gravada({})],
    fluxoDatas: [],
    envioStatus: "concluido",
    envioSimulado: false,
    viosTarefaId: "934633",
    envioErro: null,
    enviadoEm: null,
    ...campos,
  };
}

describe("revisorEstaNaTarefa", () => {
  const sessao = (campos: Partial<AgendamentoResumo>) =>
    agendamento({ etiqueta: "COMPROMISSO", tarefa: "SESSÃO DE JULGAMENTO", responsavel: "Lorena Lourenço Miranda", revisor: "Vanessa Lanza Sellani", ...campos });

  it("Sessão de Julgamento: acha o revisor entre os responsáveis da tarefa no VIOS", () => {
    expect(revisorEstaNaTarefa(sessao({ viosTarefas: [gravada({ responsaveis: "Lorena Lourenço Miranda, Vanessa Lanza Sellani" })] }))).toBe(true);
    // O VIOS não garante a ordem (como no 3. PROTOCOLAR: "Samuel Willian Silva, Lorena Lourenço Miranda").
    expect(revisorEstaNaTarefa(sessao({ viosTarefas: [gravada({ responsaveis: "Vanessa Lanza Sellani, Lorena Lourenço Miranda" })] }))).toBe(true);
    expect(revisorEstaNaTarefa(sessao({ viosTarefas: [gravada({ responsaveis: "Lorena Lourenço Miranda" })] }))).toBe(false);
  });

  it("não responde quando não se aplica ou quando o robô não devolveu os responsáveis", () => {
    expect(revisorEstaNaTarefa(sessao({ viosTarefas: null }))).toBeNull();
    expect(revisorEstaNaTarefa(sessao({ viosTarefas: [gravada({ responsaveis: null })] }))).toBeNull();
    expect(revisorEstaNaTarefa(sessao({ revisor: null }))).toBeNull();
    expect(revisorEstaNaTarefa(agendamento({}))).toBeNull();
  });

  it("o revisor na tarefa não muda o resultado da conferência", () => {
    const comparacao = compararTarefa(sessao({ viosTarefas: [gravada({ responsaveis: "Lorena Lourenço Miranda, Vanessa Lanza Sellani" })] }));
    expect(comparacao.responsavel.situacao).toBe("confere");
    expect(comparacao.responsavel.aMais).toEqual(["Vanessa Lanza Sellani"]);
    expect(comparacao.divergencias).toEqual([]);
  });
});

describe("compararTarefa", () => {
  it("confere quando data e responsável batem", () => {
    const comparacao = compararTarefa(agendamento({}));
    expect(comparacao.situacao).toBe("confere");
    expect(comparacao.ci).toBe("934633");
    expect(comparacao.divergencias).toEqual([]);
  });

  it("aponta a data diferente da pedida", () => {
    const comparacao = compararTarefa(agendamento({ viosTarefas: [gravada({ data: "2026-11-10" })] }));
    expect(comparacao.situacao).toBe("diverge");
    expect(comparacao.divergencias).toEqual([{ campo: "data", texto: "data pedida 09/11/2026, no VIOS 10/11/2026" }]);
  });

  it("não deduz o horário que o robô não devolveu: fica conferir no VIOS", () => {
    const comparacao = compararTarefa(agendamento({ etiqueta: "COMPROMISSO", hora: "13:15", viosTarefas: [gravada({ hora: null })] }));
    expect(comparacao.hora).toEqual({ pedido: "13:15", noVios: null, situacao: "sem_dado" });
    expect(comparacao.situacao).toBe("conferir");
  });

  it("compara o horário quando o robô devolve", () => {
    expect(compararTarefa(agendamento({ hora: "13:15", viosTarefas: [gravada({ hora: "13:15:00" })] })).hora?.situacao).toBe("confere");
    expect(compararTarefa(agendamento({ hora: "13:15", viosTarefas: [gravada({ hora: "14:00" })] })).situacao).toBe("diverge");
  });

  it("responsável pedido fora do VIOS diverge; a mais no VIOS só informa", () => {
    const faltando = compararTarefa(agendamento({ viosTarefas: [gravada({ responsaveis: "Vanessa Lanza Sellani" })] }));
    expect(faltando.responsavel.faltando).toEqual(["Letícia Zamarion Julio"]);
    expect(faltando.situacao).toBe("diverge");
    const aMais = compararTarefa(agendamento({ viosTarefas: [gravada({ responsaveis: "leticia zamarion julio, Samuel Willian Silva" })] }));
    expect(aMais.responsavel.aMais).toEqual(["Samuel Willian Silva"]);
    expect(aMais.situacao).toBe("confere");
  });

  it("sem o retorno do robô, nada diverge: conferir no VIOS pelo CI", () => {
    const comparacao = compararTarefa(agendamento({ viosTarefas: null }));
    expect(comparacao.gravada).toBeNull();
    expect(comparacao.ci).toBe("934633");
    expect(comparacao.situacao).toBe("conferir");
  });

  it("confere a data do fluxo escolhida pelo jurídico nas tarefas gravadas com o mesmo nome", () => {
    const viosTarefas = [
      gravada({}),
      gravada({ ci: "934635", tipo: "2. REVISAR", principal: false, data: "2026-11-10" }),
      gravada({ ci: "934637", tipo: "2. REVISAR", principal: false, data: "2026-11-13" }),
    ];
    const confere = compararTarefa(agendamento({ viosTarefas, fluxoDatas: [{ caminho: ["EMBARGOS DE DECLARAÇÃO", "2. REVISAR"], data: "2026-11-13" }] }));
    expect(confere.datasDoFluxo[0]).toMatchObject({ nome: "2. REVISAR", situacao: "confere" });
    const diverge = compararTarefa(agendamento({ viosTarefas, fluxoDatas: [{ caminho: ["2. REVISAR"], data: "2026-11-11" }] }));
    expect(diverge.divergencias).toEqual([{ campo: "fluxo", texto: "2. REVISAR: data pedida 11/11/2026, no VIOS 10/11/2026 e 13/11/2026" }]);
    const semDado = compararTarefa(agendamento({ viosTarefas, fluxoDatas: [{ caminho: ["3. PROTOCOLAR"], data: "2026-11-11" }] }));
    expect(semDado.situacao).toBe("conferir");
  });
});

describe("situacaoDoCheck", () => {
  it("uma tarefa divergente basta; sem tarefas, conferir", () => {
    const ok = agendamento({});
    const errada = agendamento({ id: "a2", viosTarefas: [gravada({ data: "2026-11-10" })] });
    expect(situacaoDoCheck({ agendamentos: [ok, errada] })).toBe("diverge");
    expect(situacaoDoCheck({ agendamentos: [ok] })).toBe("confere");
    expect(situacaoDoCheck({ agendamentos: [] })).toBe("conferir");
  });
});

describe("sugestões da inconsistência", () => {
  it("subtipo pela divergência e texto com a tarefa e o CI", () => {
    expect(subtipoSugerido(["responsavel"])).toBe("RESPONSÁVEL - (P/A)");
    expect(subtipoSugerido(["responsavel", "data"])).toBe("DATA / HORÁRIO - (P/A)");
    expect(subtipoSugerido([])).toBeNull();
    const ok = agendamento({});
    const errada = agendamento({ id: "a2", tarefa: "INFORMAR CLIENTE", viosTarefas: [gravada({ ci: "934637", data: "2026-11-10" })], viosTarefaId: "934637" });
    expect(descricaoSugerida([ok, errada])).toBe("Tarefa 2 · INFORMAR CLIENTE (CI 934637): data pedida 09/11/2026, no VIOS 10/11/2026.");
    expect(descricaoSugerida([ok, errada], ["a1"])).toBe("");
  });
});

describe("tiposDoItem", () => {
  it("separa a Ciência NF e classifica o resto pela classe, sem a Ciência dos Agendamentos", () => {
    expect(
      tiposDoItem({
        agendamentos: [
          agendamento({ etiqueta: "PROVIDENCIA", tarefa: "CIÊNCIA NF" }),
          agendamento({ etiqueta: "PROVIDENCIA", tarefa: "1. CIÊNCIA DOS AGENDAMENTOS" }),
        ],
      })
    ).toEqual(["CIENCIA_NF"]);
    expect(
      tiposDoItem({
        agendamentos: [
          agendamento({ etiqueta: "COMPROMISSO", tarefa: "SESSÃO DE JULGAMENTO" }),
          agendamento({ etiqueta: "PRAZO", tarefa: "RECURSO ORDINÁRIO" }),
          agendamento({ etiqueta: "PROVIDENCIA", tarefa: "INFORMAR CLIENTE" }),
        ],
      })
    ).toEqual(["PRAZO", "PROVIDENCIA", "COMPROMISSO"]);
    expect(tiposDoItem({ agendamentos: [] })).toEqual([]);
  });
});

describe("notaDoCheckAutomatico", () => {
  const cienciaNf = (campos: Partial<AgendamentoResumo> = {}) =>
    agendamento({
      etiqueta: "PROVIDENCIA",
      tarefa: "CIÊNCIA NF",
      data: "2026-11-10",
      dataFatal: null,
      diasPrazo: null,
      contagemPrazo: null,
      responsavel: "Ligia Gilberti Lopes",
      revisor: null,
      viosTarefaId: "938042",
      viosTarefas: [gravada({ ci: "938042", tipo: "CIÊNCIA NF", data: "2026-11-10", dataLimite: "2026-11-10", responsaveis: "Ligia Gilberti Lopes" })],
      ...campos,
    });

  it("CIÊNCIA NF única, gravada no VIOS com o CI e conferindo: check automático", () => {
    const nota = notaDoCheckAutomatico([cienciaNf()]);
    expect(nota).toBe("Check automático: CIÊNCIA NF única agendada no VIOS (CI 938042), com a data e o responsável do pedido.");
    expect(foiCheckAutomatico(null, nota)).toBe(true);
    // Check de uma pessoa (ou nota escrita por ela) não é o automático.
    expect(foiCheckAutomatico("auth-id", nota)).toBe(false);
    expect(foiCheckAutomatico(null, "Ok, conferido.")).toBe(false);
  });

  it("fica para a Maria: com outra tarefa junto, outra tarefa sozinha, simulação ou robô sem terminar", () => {
    expect(notaDoCheckAutomatico([cienciaNf(), cienciaNf({ id: "a2" })])).toBeNull();
    expect(notaDoCheckAutomatico([cienciaNf(), agendamento({ id: "a2" })])).toBeNull();
    expect(notaDoCheckAutomatico([agendamento({})])).toBeNull();
    expect(notaDoCheckAutomatico([cienciaNf({ envioSimulado: true })])).toBeNull();
    expect(notaDoCheckAutomatico([cienciaNf({ envioStatus: "erro" })])).toBeNull();
    expect(notaDoCheckAutomatico([])).toBeNull();
  });

  it("fica para a Maria: sem o retorno do robô (CI ou dados) ou com divergência", () => {
    expect(notaDoCheckAutomatico([cienciaNf({ viosTarefas: null, viosTarefaId: null })])).toBeNull();
    // Plano B (direto na pasta) sem o que foi gravado: não dá para conferir sozinho.
    expect(notaDoCheckAutomatico([cienciaNf({ viosTarefas: null })])).toBeNull();
    expect(notaDoCheckAutomatico([cienciaNf({ viosTarefas: [gravada({ ci: "938042", tipo: "CIÊNCIA NF", data: "2026-11-11", responsaveis: "Ligia Gilberti Lopes" })] })])).toBeNull();
    expect(notaDoCheckAutomatico([cienciaNf({ viosTarefas: [gravada({ ci: "938042", tipo: "CIÊNCIA NF", data: "2026-11-10", responsaveis: "Outra Pessoa" })] })])).toBeNull();
  });

  it("VERIFICAR RENÚNCIA única segue a mesma regra da CIÊNCIA NF", () => {
    const verificarRenuncia = (campos: Partial<AgendamentoResumo> = {}) =>
      cienciaNf({
        tarefa: "VERIFICAR RENÚNCIA",
        responsavel: "Marina Silva Pinelli",
        viosTarefaId: "940100",
        viosTarefas: [gravada({ ci: "940100", tipo: "VERIFICAR RENÚNCIA", data: "2026-11-10", dataLimite: "2026-11-11", responsaveis: "Marina Silva Pinelli" })],
        ...campos,
      });
    expect(notaDoCheckAutomatico([verificarRenuncia()])).toBe(
      "Check automático: VERIFICAR RENÚNCIA única agendada no VIOS (CI 940100), com a data e o responsável do pedido."
    );
    // Com a Ciência dos Agendamentos (as vistadas antes de 10/11) ou outra tarefa junto, fica para o check manual.
    expect(notaDoCheckAutomatico([verificarRenuncia(), agendamento({ id: "a2", tarefa: "1. CIÊNCIA DOS AGENDAMENTOS" })])).toBeNull();
    expect(notaDoCheckAutomatico([verificarRenuncia({ responsavel: "Outra Pessoa" })])).toBeNull();
    expect(notaDoCheckAutomatico([verificarRenuncia({ envioSimulado: true })])).toBeNull();
    // Os outros tipos de renúncia não entram.
    expect(notaDoCheckAutomatico([verificarRenuncia({ tarefa: "RENÚNCIA / SUBSTABELECIMENTO" })])).toBeNull();
  });
});
