import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AgendamentoResumo } from "@/lib/vistagem/types";
import { CartoesTarefas } from "./tarefas-conferencia";

function agendamento(campos: Partial<AgendamentoResumo> = {}): AgendamentoResumo {
  return {
    id: "a1",
    ordem: 1,
    etiqueta: "PROVIDENCIA",
    tarefa: "CIÊNCIA NF",
    tarefaId: "796",
    data: "2026-11-17",
    dataFatal: null,
    diasPrazo: null,
    contagemPrazo: null,
    hora: null,
    horaFim: null,
    responsavel: "Ana Souza",
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

const cartoes = (item: AgendamentoResumo, extras: Partial<Parameters<typeof CartoesTarefas>[0]> = {}) =>
  renderToStaticMarkup(<CartoesTarefas agendamentos={[item]} comEnvio={false} fotos={{}} hoje="2026-11-09" {...extras} />);

describe("CartoesTarefas: o lápis", () => {
  const editar = { onEditar: () => undefined, podeEditar: (item: AgendamentoResumo) => item.envioStatus === "nao_enviado" };

  it("aparece na tarefa que ainda pode mudar", () => {
    expect(cartoes(agendamento(), editar)).toContain('aria-label="Editar data e responsáveis de CIÊNCIA NF"');
  });

  it("não aparece quando a mudança não chegaria ao VIOS", () => {
    expect(cartoes(agendamento({ envioStatus: "concluido" }), editar)).not.toContain("Editar data e responsáveis");
  });

  it("não aparece nas telas que não pedem (Agendadas do jurídico)", () => {
    expect(cartoes(agendamento())).not.toContain("Editar data e responsáveis");
  });
});

describe("CartoesTarefas: ajustes da conferência", () => {
  it("mostra quem ajustou e o que mudou", () => {
    const html = cartoes(
      agendamento({
        ajustes: [{ por: "Maria Heloiza", em: "2026-11-09T17:30:00.000Z", mudancas: [{ campo: "Responsável", de: "Ana Souza", para: "Carla Dias" }] }],
      })
    ).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    expect(html).toContain("Ajustada na conferência por Maria Heloiza");
    expect(html).toContain("09/11");
    expect(html).toContain("14:30");
    expect(html).toContain("Responsável: Ana Souza");
    expect(html).toContain("Carla Dias");
  });

  it("sem ajuste, o cartão não fala nisso", () => {
    expect(cartoes(agendamento({ ajustes: [] }))).not.toContain("Ajustada na conferência");
  });
});
