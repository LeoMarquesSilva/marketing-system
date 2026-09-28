import { describe, expect, it } from "vitest";
import {
  buildSioeViosTaskPayload,
  isSioeViosTaskCancelled,
  mapSioeViosStatus,
  type ExistingViosTaskRow,
  type SioeViosTaskRow,
} from "@/lib/vios-sioe-sync-server";

const SYNCED_AT = "2026-09-15T16:00:00.000Z";

function sourceRow(
  overrides: Partial<SioeViosTaskRow> = {}
): SioeViosTaskRow {
  return {
    ci: 800001,
    ci_processo: 52091,
    area_processo: "Cível",
    tarefa: "2. REVISAR",
    tarefa_pai: "MATERIAL MARKETING - REELS/POST/ARTIGO",
    etiqueta_tarefa: "REVISAR",
    status: "Aberta",
    usuario_conclusao: null,
    conclusao_completa: null,
    data_conclusao: null,
    data_para_conclusao: "2026-09-20",
    responsavel: null,
    updated_at: "2026-09-15T15:30:00.000Z",
    ...overrides,
  };
}

function existingRow(
  overrides: Partial<ExistingViosTaskRow> = {}
): ExistingViosTaskRow {
  return {
    vios_id: "800001",
    ci_processo: "52091",
    area_processo: "Cível",
    descricao: "Descrição rica do CSV",
    comentarios: "Comentário preservado",
    historico: "Histórico preservado",
    hora_conclusao: "14:30",
    responsaveis: "Maria Exemplo",
    assignee_id: "user-maria",
    marketing_request_id: "request-1",
    raw_data: { csv: { original: true } },
    status: "em_andamento",
    data_limite: "2026-09-18",
    data_limite_anterior: null,
    prorrogada: false,
    is_cancelled: false,
    ...overrides,
  };
}

describe("sync de tarefas VIOS via SIOE", () => {
  it("mapeia os status do SIOE para o domínio do Marketing", () => {
    expect(mapSioeViosStatus("Concluída")).toBe("concluido");
    expect(mapSioeViosStatus("Aberta")).toBe("em_andamento");
    expect(mapSioeViosStatus("Em execução")).toBe("em_andamento");
    expect(mapSioeViosStatus(null)).toBe("pendente");
    expect(isSioeViosTaskCancelled("Cancelada")).toBe(true);
  });

  it("preserva os campos ricos e vínculos ausentes no SIOE", () => {
    const payload = buildSioeViosTaskPayload(
      sourceRow(),
      existingRow(),
      [{ id: "user-maria", name: "Maria Exemplo" }],
      SYNCED_AT
    );

    expect(payload).toMatchObject({
      descricao: "Descrição rica do CSV",
      comentarios: "Comentário preservado",
      historico: "Histórico preservado",
      hora_conclusao: "14:30",
      responsaveis: "Maria Exemplo",
      assignee_id: "user-maria",
      marketing_request_id: "request-1",
      is_cancelled: false,
    });
    expect(payload.raw_data).toMatchObject({
      csv: { original: true },
      sioe: { source_status: "Aberta" },
    });
  });

  it("atualiza responsável somente quando o SIOE o fornece", () => {
    const payload = buildSioeViosTaskPayload(
      sourceRow({ responsavel: "Leonardo Marques Silva | Ana Nova" }),
      existingRow(),
      [{ id: "user-ana", name: "Ana Nova" }],
      SYNCED_AT
    );

    expect(payload.responsaveis).toBe("Ana Nova");
    expect(payload.assignee_id).toBe("user-ana");
  });

  it("detecta prorrogação pela mudança de prazo", () => {
    const payload = buildSioeViosTaskPayload(
      sourceRow({ data_para_conclusao: "2026-09-25" }),
      existingRow({ data_limite: "2026-09-18" }),
      [],
      SYNCED_AT
    );

    expect(payload.prorrogada).toBe(true);
    expect(payload.data_limite_anterior).toBe("2026-09-18");
    expect(payload.data_limite).toBe("2026-09-25");
  });

  it("arquiva canceladas sem transformar revisão em concluída", () => {
    const payload = buildSioeViosTaskPayload(
      sourceRow({ status: "Cancelada" }),
      existingRow({ status: "em_andamento" }),
      [],
      SYNCED_AT
    );

    expect(payload.is_cancelled).toBe(true);
    expect(payload.status).toBe("em_andamento");
    expect(payload.source_status).toBe("Cancelada");
  });

  it("produz o mesmo payload ao repetir a mesma entrada", () => {
    const row = sourceRow();
    const current = existingRow();
    const users = [{ id: "user-maria", name: "Maria Exemplo" }];

    expect(
      buildSioeViosTaskPayload(row, current, users, SYNCED_AT)
    ).toEqual(buildSioeViosTaskPayload(row, current, users, SYNCED_AT));
  });
});
