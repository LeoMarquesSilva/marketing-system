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
    hora: "13:30",
    horaFim: "14:30",
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
