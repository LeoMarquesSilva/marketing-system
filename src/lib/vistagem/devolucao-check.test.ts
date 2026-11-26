import { describe, expect, it } from "vitest";
import {
  cisDaTarefa,
  devolucaoPendente,
  motivoDaDevolucao,
  planoDaDevolucao,
  situacaoDoCancelamento,
  textoDaSituacao,
  type AgendamentoParaDevolver,
} from "./devolucao-check";

// 2041725-27.2026.8.26.0000 (25/11/2026): duas Providências no VIOS, num lançamento só.
const tarefa = (f: Partial<AgendamentoParaDevolver>): AgendamentoParaDevolver => ({
  tarefa: "VERIFICAR DOCUMENTOS",
  etiqueta: "PROVIDENCIA",
  data: "2026-11-25",
  data_fatal: null,
  responsavel: "Letícia Santana Rodrigues",
  envio_status: "concluido",
  envio_simulado: false,
  sama_agendamento_id: "lanc-1",
  vios_tarefa_id: "947527",
  vios_tarefas: [{ ci: "947527" }],
  enviado_em: "2026-11-24T16:52:03Z",
  ...f,
});

describe("devolução do Check para a Vistagem", () => {
  it("o motivo é o erro do check", () => {
    expect(motivoDaDevolucao({ tipo: "ANÁLISE", subtipo: "FORA DO FLUXO - (P/A)", descricao: " Falta a SESSÃO DE JULGAMENTO " })).toBe(
      "ANÁLISE (FORA DO FLUXO - (P/A)): Falta a SESSÃO DE JULGAMENTO"
    );
    expect(motivoDaDevolucao({ tipo: "AGENDAMENTO", subtipo: null, descricao: "Data errada" })).toBe("AGENDAMENTO: Data errada");
  });

  it("CIs da tarefa: a principal e as do fluxo, sem repetir", () => {
    expect(cisDaTarefa({ vios_tarefa_id: "948484", vios_tarefas: [{ ci: 948484 }, { ci: 948485 }, { ci: "948486" }] })).toEqual(["948484", "948485", "948486"]);
    expect(cisDaTarefa({ vios_tarefa_id: "947528", vios_tarefas: null })).toEqual(["947528"]);
  });

  it("plano: as tarefas no VIOS e um cancelamento por lançamento", () => {
    const plano = planoDaDevolucao([
      tarefa({}),
      tarefa({ tarefa: "1. CIÊNCIA DOS AGENDAMENTOS", vios_tarefa_id: "947528", vios_tarefas: [{ ci: "947528" }] }),
      // Simulada: não está no VIOS.
      tarefa({ tarefa: "SIMULADA", envio_simulado: true, sama_agendamento_id: "lanc-2", vios_tarefa_id: "1", vios_tarefas: null }),
      // Ainda não enviada (nova na Conferência): não entra.
      tarefa({ tarefa: "NOVA", envio_status: "nao_enviado", sama_agendamento_id: null, vios_tarefa_id: null, vios_tarefas: null }),
    ]);
    expect(plano.ok).toBe(true);
    if (!plano.ok) return;
    expect(plano.tarefas.map((item) => [item.tarefa, item.cis])).toEqual([
      ["VERIFICAR DOCUMENTOS", ["947527"]],
      ["1. CIÊNCIA DOS AGENDAMENTOS", ["947528"]],
    ]);
    expect(plano.lancamentos).toEqual([{ origemId: "lanc-1", cis: ["947527", "947528"] }]);
  });

  it("não devolve enquanto o robô trabalha nas tarefas", () => {
    expect(planoDaDevolucao([tarefa({ envio_status: "processando" })])).toEqual({
      ok: false,
      erro: "O robô ainda está com tarefas desta publicação. Espere terminar para devolver.",
    });
  });

  it("situação do cancelamento pela fila do SAMA", () => {
    const pedido = { origemId: "lanc-1", samaId: "canc-1", cis: ["947527", "947528"] };
    expect(situacaoDoCancelamento(pedido, { status: "pendente", erro: null, resultado: null })).toEqual({ estado: "na_fila" });
    expect(situacaoDoCancelamento(pedido, { status: "processando", erro: null, resultado: null })).toEqual({ estado: "cancelando" });
    expect(situacaoDoCancelamento(pedido, { status: "erro", erro: "VIOS fora do ar", resultado: null })).toEqual({ estado: "erro", erro: "VIOS fora do ar" });
    const feito = situacaoDoCancelamento(pedido, {
      status: "concluido",
      erro: null,
      resultado: { canceladas: ["947527"], ja_concluidas: ["947528"], ja_canceladas: [], falhas: [] },
    });
    expect(feito).toEqual({ estado: "feito", canceladas: ["947527"], jaConcluidas: ["947528"], jaCanceladas: [], falhas: [] });
    expect(textoDaSituacao(feito, pedido.cis)).toBe("Cancelamento no VIOS: canceladas CI 947527; já concluídas, ficaram como estão: CI 947528.");
    expect(situacaoDoCancelamento({ ...pedido, samaId: null, erro: "SAMA fora do ar" }, null)).toEqual({ estado: "nao_pedido", erro: "SAMA fora do ar" });
    expect(textoDaSituacao({ estado: "erro", erro: "VIOS fora do ar" }, pedido.cis)).toBe(
      "O robô não cancelou (VIOS fora do ar). Cancele à mão no VIOS: CI 947527, 947528."
    );
  });

  it("devolução pendente: no jurídico, antes de vistar de novo ou reabrir", () => {
    const base = { status: "juridico_vistar", devolvidoEm: "2026-11-25T18:40:00Z", revistadoEm: null, reabertaEm: null };
    expect(devolucaoPendente(base)).toBe(true);
    expect(devolucaoPendente({ ...base, status: "controladoria_vistar" })).toBe(false);
    expect(devolucaoPendente({ ...base, revistadoEm: "2026-11-25T19:00:00Z" })).toBe(false);
    // Vistada de novo numa devolução anterior: esta é nova.
    expect(devolucaoPendente({ ...base, revistadoEm: "2026-11-20T10:00:00Z" })).toBe(true);
    expect(devolucaoPendente({ ...base, devolvidoEm: null })).toBe(false);
  });
});
