import { describe, expect, it } from "vitest";
import {
  buildPautas,
  countDeliveredInMonth,
  followupStatus,
  MARKETING_PAUTA_TASK,
  pautasForBoard,
  type FollowupEntry,
  type SioeTaskRow,
} from "./followups";

function row(partial: Partial<SioeTaskRow> & { ci: number }): SioeTaskRow {
  return {
    ci_processo: 1, cliente: "Área Trabalhista", tarefa: MARKETING_PAUTA_TASK, tarefa_pai: null, status: "Aberta",
    data_conclusao: null, data_para_conclusao: "2026-11-09", responsavel: null, usuario_conclusao: null,
    area_conclusao: null, ...partial,
  };
}

const child = (ci: number, tarefa: string, status = "Aberta") =>
  row({ ci, tarefa, tarefa_pai: MARKETING_PAUTA_TASK, status });

function entry(partial: Partial<FollowupEntry>): FollowupEntry {
  return { id: "f", channel: "teams", note: null, returnDue: null, sentAt: "2026-11-10T13:00:00Z", sentByName: null, ...partial };
}

describe("buildPautas", () => {
  it("agrupa a tarefa principal com revisão e protocolo e calcula a etapa", () => {
    const pautas = buildPautas([
      row({ ci: 10 }), child(11, "2. REVISAR"), child(12, "3. PROTOCOLAR"),
      row({ ci: 20, status: "Concluída", data_conclusao: "2026-11-05" }), child(21, "2. REVISAR", "Concluída"), child(22, "3. PROTOCOLAR"),
      row({ ci: 30, status: "Cancelada" }),
    ]);
    expect(pautas.map((pauta) => [pauta.ci, pauta.stage])).toEqual([
      [10, "aguardando_envio"], [20, "em_protocolo"], [30, "cancelada"],
    ]);
    expect(pautas[0].relatedCis).toEqual([10, 11, 12]);
    expect(pautas[0].sioeArea).toBe("Trabalhista");
  });
});

describe("followupStatus", () => {
  const [open] = buildPautas([row({ ci: 10 })]);
  const [done] = buildPautas([row({ ci: 20, status: "Concluída", data_conclusao: "2026-11-12" })]);

  it("pede cobrança quando venceu e ninguém cobrou", () => {
    expect(followupStatus(open, [], "2026-11-10")).toBe("cobrar");
    expect(followupStatus(open, [], "2026-11-09")).toBe("no_prazo");
  });

  it("separa retorno no prazo de retorno vencido", () => {
    expect(followupStatus(open, [entry({ returnDue: "2026-11-13" })], "2026-11-12")).toBe("aguardando_retorno");
    expect(followupStatus(open, [entry({ returnDue: "2026-11-13" })], "2026-11-14")).toBe("retorno_vencido");
  });

  it("marca entrega depois de cobrança", () => {
    expect(followupStatus(done, [entry({})], "2026-11-14")).toBe("entregue_apos_cobranca");
    expect(followupStatus(done, [], "2026-11-14")).toBe("entregue");
  });
});

describe("recortes do mês", () => {
  const pautas = buildPautas([
    row({ ci: 10, ci_processo: 1, data_para_conclusao: "2026-09-01" }),
    row({ ci: 20, ci_processo: 2, status: "Concluída", data_conclusao: "2026-11-05", data_para_conclusao: "2026-10-30" }),
    row({ ci: 30, ci_processo: 3, data_para_conclusao: "2026-12-08" }),
  ]);

  it("conta entregues pela data de conclusão", () => {
    expect(countDeliveredInMonth(pautas, "2026-11")).toBe(1);
  });

  it("traz as vencidas de meses anteriores e deixa de fora as futuras", () => {
    expect(pautasForBoard(pautas, "2026-11", "2026-11-10").map((pauta) => pauta.ci)).toEqual([10, 20]);
  });
});
