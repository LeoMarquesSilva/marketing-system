import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TarefaNoVios } from "@/lib/vistagem/fila-vios";
import type { AgendamentoResumo } from "@/lib/vistagem/types";
import { CartoesCheck } from "./tarefas-check";

const LORENA = "Lorena Lourenço Miranda";
const VANESSA = "Vanessa Lanza Sellani";

function gravada(responsaveis: string | null): TarefaNoVios {
  return { ci: "937294", tipo: "SESSÃO DE JULGAMENTO", principal: true, data: "2026-11-17", dataLimite: "2026-11-17", hora: null, responsaveis };
}

function agendamento(campos: Partial<AgendamentoResumo>): AgendamentoResumo {
  return {
    id: "a1",
    ordem: 1,
    etiqueta: "COMPROMISSO",
    tarefa: "SESSÃO DE JULGAMENTO",
    tarefaId: "406",
    data: "2026-11-17",
    dataFatal: null,
    diasPrazo: null,
    contagemPrazo: null,
    origemPrazo: null,
    hora: "13:30",
    horaFim: "14:30",
    dataLimite: null,
    responsavel: LORENA,
    revisor: VANESSA,
    observacao: null,
    viosTarefas: [gravada(`${LORENA}, ${VANESSA}`)],
    fluxoDatas: [],
    envioStatus: "concluido",
    envioSimulado: false,
    viosTarefaId: "937294",
    envioErro: null,
    enviadoEm: null,
    ...campos,
  };
}

/** A linha "Revisor" da comparação: o texto dela e a marca do resultado. */
function linhaDoRevisor(item: AgendamentoResumo) {
  const html = renderToStaticMarkup(<CartoesCheck agendamentos={[item]} fotos={{}} hoje="2026-11-09" />);
  const linha = html.split("<tr").find((trecho) => trecho.includes(">Revisor<")) ?? "";
  return { texto: linha.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(), confere: linha.includes('title="Confere"') };
}

describe("CartoesCheck: linha Revisor", () => {
  it("Sessão de Julgamento com o revisor na tarefa: mostra quem está no VIOS e marca que confere", () => {
    const { texto, confere } = linhaDoRevisor(agendamento({}));
    expect(texto.match(/Vanessa Sellani/g)).toHaveLength(2);
    expect(texto).not.toContain("Não veio do robô");
    expect(confere).toBe(true);
  });

  it("Sessão de Julgamento lançada sem o revisor: pede para conferir no VIOS, sem dizer que confere", () => {
    const { texto, confere } = linhaDoRevisor(agendamento({ viosTarefas: [gravada(LORENA)] }));
    expect(texto).toContain("Não está na tarefa: confira no VIOS");
    expect(confere).toBe(false);
  });

  it("Sessão de Julgamento sem os responsáveis devolvidos pelo robô: continua não vindo do robô", () => {
    const { texto, confere } = linhaDoRevisor(agendamento({ viosTarefas: [gravada(null)] }));
    expect(texto).toContain("Não veio do robô");
    expect(confere).toBe(false);
  });

  it("outro Compromisso continua como era: o revisor não é procurado na tarefa", () => {
    const { texto, confere } = linhaDoRevisor(agendamento({ tarefa: "AUDIÊNCIA UNA/INICIAL", viosTarefas: [gravada(`${LORENA}, ${VANESSA}`)] }));
    expect(texto).toContain("Não veio do robô");
    expect(confere).toBe(false);
  });
});

describe("CartoesCheck: ajustes da Conferência", () => {
  const texto = (item: AgendamentoResumo) =>
    renderToStaticMarkup(<CartoesCheck agendamentos={[item]} fotos={{}} hoje="2026-11-09" />)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ");

  it("mostra quem alterou a data e o horário, quando e de quanto para quanto", () => {
    const html = texto(
      agendamento({
        ajustes: [
          {
            por: "Giovanna Pereira de Souza",
            em: "2026-11-17T16:29:55.298Z",
            mudancas: [
              { campo: "Data e horário", de: "17/11/2026 às 13:30", para: "18/11/2026 às 14:00" },
              { campo: "Responsável", de: LORENA, para: VANESSA },
            ],
          },
        ],
      })
    );
    expect(html).toContain("Ajustada na conferência por Giovanna Pereira de Souza");
    expect(html).toContain("17/11");
    expect(html).toContain("13:29");
    expect(html).toContain("Data e horário: 17/11/2026 às 13:30");
    expect(html).toContain("18/11/2026 às 14:00");
    expect(html).toContain(`Responsável: ${LORENA}`);
  });

  it("sem ajuste, o cartão não fala nisso", () => {
    expect(texto(agendamento({ ajustes: [] }))).not.toContain("Ajustada na conferência");
    expect(texto(agendamento({}))).not.toContain("Ajustada na conferência");
  });
});
