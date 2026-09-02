import {
  addHours,
  fatalProtocolarDate,
  unaDefesaDate,
  unaProtocolarDate,
} from "@/lib/operacoes-legais/vistagem/rules/calendar";
import type { Publication, TaskType } from "@/lib/operacoes-legais/vistagem/types";

export type SchedulePayload = {
  publication_id: string;
  ci: string;
  tipo_vios: string;
  data_prevista: string;
  data_limite: string;
  data_fatal: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  descricao: string;
  skip: boolean;
  skip_reason?: string;
  expected_chain: Array<{
    code: string;
    label: string;
    data: string;
  }>;
  idempotency_key: string;
};

export function buildSchedulePayload(
  pub: Publication,
  taskType: TaskType | null,
): SchedulePayload {
  const tipo = taskType?.label_vios || pub.tipo_agendamento_label || "";
  if (taskType?.kind === "skip" || /contesta/i.test(tipo)) {
    return {
      publication_id: pub.id,
      ci: pub.ci || "",
      tipo_vios: tipo,
      data_prevista: pub.data_conclusao || "",
      data_limite: pub.data_limite || pub.data_conclusao || "",
      data_fatal: pub.data_fatal,
      hora_inicio: null,
      hora_fim: null,
      descricao: "",
      skip: true,
      skip_reason: "Tipo NÃO AGENDAR (ex.: contestação nasce da UNA)",
      expected_chain: [],
      idempotency_key: `${pub.id}|SKIP`,
    };
  }

  const data = pub.data_conclusao || pub.data_limite;
  if (!pub.ci || !data || !tipo) {
    throw new Error("Publicação incompleta para agendar (CI, data ou tipo)");
  }

  const dataLimite = pub.data_limite || data;
  if (data !== dataLimite) {
    // regra absoluta: forçar iguais
  }
  const dataFinal = data;

  let horaInicio = pub.hora_inicio;
  let horaFim = pub.hora_fim;
  if (taskType?.requires_hora || /AUD|PER[IÍ]CIA/i.test(tipo)) {
    horaInicio = horaInicio || "09:00";
    horaFim = horaFim || addHours(horaInicio.slice(0, 5), 1);
  }

  const expected_chain: SchedulePayload["expected_chain"] = [
    {
      code: "ROOT",
      label: tipo,
      data: dataFinal,
    },
  ];

  if (/UNA/i.test(tipo)) {
    expected_chain.push(
      {
        code: "PROTOCOLAR",
        label: "3. PROTOCOLAR (contestação)",
        data: unaProtocolarDate(dataFinal),
      },
      {
        code: "ENVIAR_DEFESA",
        label: "ENVIAR DEFESA PARA VALIDAÇÃO DO CLIENTE",
        data: unaDefesaDate(dataFinal),
      },
    );
  } else if (pub.data_fatal) {
    expected_chain.push({
      code: "PROTOCOLAR",
      label: "3. PROTOCOLAR",
      data: fatalProtocolarDate(pub.data_fatal),
    });
  }

  const descParts = [
    pub.juridico_texto?.trim(),
    pub.data_fatal ? `FATAL = ${pub.data_fatal}` : null,
    `Publicação ${pub.id}`,
  ].filter(Boolean);

  const idempotency_key = [
    pub.id,
    pub.ci,
    tipo,
    dataFinal,
    horaInicio?.slice(0, 5) || "",
  ].join("|");

  return {
    publication_id: pub.id,
    ci: pub.ci,
    tipo_vios: tipo,
    data_prevista: dataFinal,
    data_limite: dataFinal,
    data_fatal: pub.data_fatal,
    hora_inicio: horaInicio,
    hora_fim: horaFim,
    descricao: descParts.join("\n"),
    skip: false,
    expected_chain,
    idempotency_key,
  };
}
