/** Perguntas fixas da pesquisa NPS Bismarchi | Pires. */

export type NpsScoreField =
  | "score_recommend"
  | "score_availability"
  | "score_communication"
  | "score_innovation"
  | "score_technical";

export type NpsTextField = "reason" | "improvement";

export interface NpsScaleQuestion {
  kind: "scale";
  id: NpsScoreField;
  label: string;
  /** Termos-chave do enunciado a destacar em negrito na página pública. */
  emphasis?: string[];
  lowLabel: string;
  highLabel: string;
  required: true;
}

export interface NpsTextQuestion {
  kind: "text";
  id: NpsTextField;
  label: string;
  /** Termos-chave do enunciado a destacar em negrito na página pública. */
  emphasis?: string[];
  placeholder?: string;
  required: false;
  rows?: number;
  /**
   * Renderiza este campo dentro do bloco da pergunta anterior, em vez de abrir
   * uma seção numerada própria (ex.: o "Motivo" pertence à nota de recomendação).
   */
  attachToPrevious?: boolean;
}

export type NpsQuestion = NpsScaleQuestion | NpsTextQuestion;

export const NPS_QUESTIONS: NpsQuestion[] = [
  {
    kind: "scale",
    id: "score_recommend",
    label:
      "Em uma escala de 0 a 10, o quanto você recomendaria o Bismarchi | Pires Sociedade de Advogados a um colega ou outras empresas?",
    emphasis: ["recomendaria"],
    lowLabel: "Definitivamente não recomendaria",
    highLabel: "Definitivamente recomendaria",
    required: true,
  },
  {
    kind: "text",
    id: "reason",
    label: "Motivo",
    placeholder: "Conte-nos o motivo da sua nota (opcional)",
    required: false,
    rows: 3,
    attachToPrevious: true,
  },
  {
    kind: "scale",
    id: "score_availability",
    label:
      "Em uma escala de 0 a 10, como você avalia a disponibilidade da equipe que o(a) atende?",
    emphasis: ["disponibilidade"],
    lowLabel: "Equipe não está disponível",
    highLabel: "Equipe totalmente disponível",
    required: true,
  },
  {
    kind: "scale",
    id: "score_communication",
    label:
      "Em uma escala de 0 a 10, como você avalia a comunicação da equipe que o(a) atende?",
    emphasis: ["comunicação"],
    lowLabel: "Comunicação totalmente insatisfatória",
    highLabel: "Comunicação totalmente satisfatória",
    required: true,
  },
  {
    kind: "scale",
    id: "score_innovation",
    label:
      "Em uma escala de 0 a 10, como você avalia a capacidade do escritório de apresentar soluções inovadoras?",
    emphasis: ["capacidade"],
    lowLabel: "Nunca apresenta soluções inovadoras",
    highLabel: "Sempre apresenta soluções inovadoras",
    required: true,
  },
  {
    kind: "scale",
    id: "score_technical",
    label:
      "Em uma escala de 0 a 10, como você avalia a competência técnica do escritório no atendimento ao seu caso?",
    emphasis: ["competência técnica"],
    lowLabel: "Competência técnica totalmente insatisfatória",
    highLabel: "Competência técnica totalmente satisfatória",
    required: true,
  },
  {
    kind: "text",
    id: "improvement",
    label: "Há algo que você acredita que poderíamos fazer para melhorar sua experiência?",
    emphasis: ["melhorar"],
    placeholder: "Sugestões de melhoria (opcional)",
    required: false,
    rows: 4,
  },
];

/**
 * Quebra o enunciado nos trechos a destacar, preservando o texto original.
 * O `label` continua puro — a página de resultados e leitores de tela usam ele.
 */
export function splitLabelEmphasis(
  label: string,
  emphasis?: string[]
): Array<{ text: string; strong: boolean }> {
  if (!emphasis?.length) return [{ text: label, strong: false }];

  const escaped = emphasis.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
  const lowered = emphasis.map((word) => word.toLowerCase());

  return label
    .split(pattern)
    .filter((part) => part.length > 0)
    .map((part) => ({ text: part, strong: lowered.includes(part.toLowerCase()) }));
}

export const NPS_SCORE_FIELDS: NpsScoreField[] = [
  "score_recommend",
  "score_availability",
  "score_communication",
  "score_innovation",
  "score_technical",
];

export interface NpsResponsePayload {
  respondentKind: "contact" | "person";
  respondentId: string;
  score_recommend: number;
  reason?: string | null;
  score_availability: number;
  score_communication: number;
  score_innovation: number;
  score_technical: number;
  improvement?: string | null;
}

function isValidScore(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 10;
}

function trimText(value: unknown, max = 4000): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/** Valida e sanitiza o payload de resposta. Retorna erros em português. */
export function validateNpsResponsePayload(
  raw: unknown
): { ok: true; data: NpsResponsePayload } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Dados inválidos." };
  }

  const body = raw as Record<string, unknown>;
  const respondentKind = body.respondentKind;
  const respondentId = typeof body.respondentId === "string" ? body.respondentId.trim() : "";

  if (respondentKind !== "contact" && respondentKind !== "person") {
    return { ok: false, error: "Selecione quem está respondendo." };
  }
  if (!respondentId || !/^[0-9a-f-]{36}$/i.test(respondentId)) {
    return { ok: false, error: "Selecione quem está respondendo." };
  }

  for (const field of NPS_SCORE_FIELDS) {
    if (!isValidScore(body[field])) {
      return { ok: false, error: "Responda todas as perguntas de escala (0 a 10)." };
    }
  }

  return {
    ok: true,
    data: {
      respondentKind,
      respondentId,
      score_recommend: body.score_recommend as number,
      reason: trimText(body.reason),
      score_availability: body.score_availability as number,
      score_communication: body.score_communication as number,
      score_innovation: body.score_innovation as number,
      score_technical: body.score_technical as number,
      improvement: trimText(body.improvement),
    },
  };
}
