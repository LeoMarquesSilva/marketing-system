import { describe, expect, it } from "vitest";
import { buildSchedulePayload } from "./engine";
import type { Publication, TaskType } from "@/lib/operacoes-legais/vistagem/types";

const basePub: Publication = {
  id: "p1",
  capture_date: "2026-08-12",
  origem: "KURRIER",
  source_filename: null,
  data_recebimento: null,
  advogado_localizado: null,
  data_divulgacao: null,
  data_publicacao: null,
  diario_divisao: null,
  pasta: "PROCESSO PRINCIPAL - CI 1",
  numero_processo: "1",
  publicacao: "x",
  responsavel_principal: null,
  escritorio_responsavel: "TRABALHISTA",
  grupo: null,
  cliente_principal: null,
  natureza: null,
  status_processo: null,
  acao: null,
  fase: null,
  processo_encerrado: null,
  motivo_encerramento: null,
  titulo: null,
  demanda_risco: false,
  prioridade_agendamento: false,
  juridico_texto: "ok",
  controladoria_texto: null,
  tipo_agendamento_id: null,
  tipo_agendamento_label: "AUDIÊNCIA UNA/INICIAL",
  data_conclusao: "2026-08-12",
  data_limite: "2026-08-12",
  data_fatal: null,
  hora_inicio: "10:00",
  hora_fim: null,
  status: "AGENDAR",
  ci: "123",
  vios_pxe_id: null,
  schedule_error: null,
  idempotency_key: null,
  created_at: "",
  updated_at: "",
};

describe("buildSchedulePayload", () => {
  it("força conclusão=limite e cadeia UNA", () => {
    const tipo: TaskType = {
      id: "t1",
      code: "AUD_UNA",
      label_vios: "AUDIÊNCIA UNA/INICIAL",
      kind: "compromisso",
      requires_hora: true,
      active: true,
      notes: null,
    };
    const p = buildSchedulePayload(basePub, tipo);
    expect(p.data_prevista).toBe(p.data_limite);
    expect(p.hora_fim).toBe("11:00");
    expect(p.expected_chain.length).toBe(3);
    expect(p.skip).toBe(false);
  });

  it("skip contestação", () => {
    const tipo: TaskType = {
      id: "t2",
      code: "CONTESTACAO",
      label_vios: "CONTESTAÇÃO",
      kind: "skip",
      requires_hora: false,
      active: true,
      notes: null,
    };
    const p = buildSchedulePayload(basePub, tipo);
    expect(p.skip).toBe(true);
  });
});
