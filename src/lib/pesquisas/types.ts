/**
 * Pesquisas com a equipe (Operações Legais > Pesquisas com a equipe).
 *
 * As perguntas moram em `team_surveys.questions` (jsonb) com ids estáveis: o
 * texto pode mudar sem perder as respostas. Este arquivo é compartilhado entre
 * servidor e navegador: tipos, validação e a apuração dos resultados.
 */

import { z } from "zod";

export const SURVEYS_PATH = "/operacoes-legais/pesquisas";
export const ANSWER_PATH_PREFIX = "/pesquisa";

export function answerPath(slug: string): string {
  return `${ANSWER_PATH_PREFIX}/${slug}`;
}

/** Em pesquisa anônima, os resultados só aparecem a partir daqui (ninguém é identificado). */
export const MIN_ANONYMOUS_RESPONSES = 3;

export const QUESTION_TYPES = [
  "secao",
  "texto_longo",
  "texto_curto",
  "escolha_unica",
  "multipla",
  "escala",
  "ranking",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  secao: "Título de seção",
  texto_longo: "Resposta longa",
  texto_curto: "Resposta curta",
  escolha_unica: "Escolha única",
  multipla: "Múltipla escolha",
  escala: "Escala de nota",
  ranking: "Ordenar prioridades",
};

export const TEXT_MAX = 4000;
export const SHORT_TEXT_MAX = 300;

const optionSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().trim().min(1, "Opção sem texto.").max(200),
});

export const questionSchema = z.object({
  id: z.string().min(1).max(40),
  type: z.enum(QUESTION_TYPES),
  title: z.string().trim().min(1, "Pergunta sem texto.").max(500),
  help: z.string().max(1000).default(""),
  required: z.boolean().default(false),
  options: z.array(optionSchema).max(20).default([]),
  /** Múltipla escolha: quantas no máximo (null = sem limite). */
  max_choices: z.number().int().min(1).max(20).nullable().default(null),
  /** Escolha única/múltipla: campo "Outro" com texto livre. */
  allow_other: z.boolean().default(false),
  scale_min: z.number().int().min(0).max(1).default(1),
  scale_max: z.number().int().min(3).max(10).default(5),
  scale_min_label: z.string().max(60).default(""),
  scale_max_label: z.string().max(60).default(""),
});

export type SurveyQuestion = z.infer<typeof questionSchema>;
export type SurveyOption = z.infer<typeof optionSchema>;

export const SURVEY_STATUSES = ["rascunho", "aberta", "encerrada"] as const;
export type SurveyStatus = (typeof SURVEY_STATUSES)[number];

export const SURVEY_STATUS_LABELS: Record<SurveyStatus, string> = {
  rascunho: "Rascunho",
  aberta: "Recebendo respostas",
  encerrada: "Encerrada",
};

export const SURVEY_BRANDS = ["pe27"] as const;
export type SurveyBrand = (typeof SURVEY_BRANDS)[number];

export const SURVEY_BRAND_LABELS: Record<SurveyBrand, string> = {
  pe27: "Planejamento Estratégico 2027",
};

export const SURVEY_BRAND_LOGOS: Record<SurveyBrand, { src: string; width: number; height: number }> = {
  pe27: { src: "/pesquisas/pe27-lockup-azul.png", width: 1200, height: 373 },
};

export interface Survey {
  id: string;
  slug: string;
  title: string;
  intro: string;
  brand: SurveyBrand | null;
  audience_departments: string[];
  anonymous: boolean;
  status: SurveyStatus;
  closes_at: string | null;
  opened_at: string | null;
  questions: SurveyQuestion[];
  ai_summary: SurveySynthesis | null;
  ai_summary_at: string | null;
  ai_summary_responses: number | null;
  created_at: string;
  updated_at: string;
}

/** Item da lista de pesquisas. */
export interface SurveyListItem {
  id: string;
  slug: string;
  title: string;
  brand: SurveyBrand | null;
  status: SurveyStatus;
  anonymous: boolean;
  closes_at: string | null;
  audience_departments: string[];
  question_count: number;
  audience_count: number;
  response_count: number;
  updated_at: string;
}

/** Pessoa do público, com foto (lista de quem respondeu e de quem falta). */
export interface SurveyPerson {
  user_id: string;
  employee_id: string | null;
  short_name: string;
  position: string | null;
  department: string | null;
  avatar_url: string | null;
}

export interface SurveyAudience {
  responded: Array<SurveyPerson & { submitted_at: string }>;
  pending: SurveyPerson[];
  /** Responderam, mas hoje estão fora do público (ex.: mudaram de área). */
  outside: number;
}

export interface SurveyDetail {
  survey: Survey;
  audience: SurveyAudience;
  departments: Array<{ name: string; count: number }>;
  response_count: number;
  /** Perguntas que já têm resposta (o editor avisa antes de apagar). */
  answered_question_ids: string[];
}

export interface SurveyResponseRow {
  /** Só em pesquisa identificada. */
  person: SurveyPerson | null;
  submitted_at: string;
  answers: SurveyAnswers;
}

export interface SurveyResults {
  survey: Survey;
  audience: SurveyAudience;
  response_count: number;
  /** Anônima com menos de MIN_ANONYMOUS_RESPONSES: ainda não mostra nada. */
  locked: boolean;
  results: QuestionResult[];
  responses: SurveyResponseRow[];
}

export interface RespondentView {
  survey: Pick<Survey, "slug" | "title" | "intro" | "brand" | "anonymous" | "closes_at" | "questions" | "status">;
  state: "aberta" | "rascunho" | "encerrada" | "fora_do_publico" | "respondida";
  submitted_at: string | null;
  /** Quem gerencia vê a prévia (sem gravar) mesmo fora do público ou em rascunho. */
  can_preview: boolean;
  first_name: string;
  /** Quem está respondendo (foto e nome no topo: a resposta é com login). */
  respondent: { short_name: string; avatar_url: string | null } | null;
}

/* ------------------------------------------------------------------ */
/* Respostas                                                           */
/* ------------------------------------------------------------------ */

/** Uma resposta por pergunta; cada tipo usa um campo. */
export const answerValueSchema = z.object({
  text: z.string().max(TEXT_MAX).optional(),
  choices: z.array(z.string().max(40)).max(20).optional(),
  other: z.string().max(SHORT_TEXT_MAX).optional(),
  number: z.number().int().min(0).max(10).optional(),
  ranking: z.array(z.string().max(40)).max(20).optional(),
});

export type AnswerValue = z.infer<typeof answerValueSchema>;
export type SurveyAnswers = Record<string, AnswerValue>;

export const answersSchema = z.record(z.string().max(40), answerValueSchema);

export const OTHER_OPTION_ID = "__outro__";

export function isAnswerable(question: SurveyQuestion): boolean {
  return question.type !== "secao";
}

/** A pergunta tem resposta preenchida? */
export function hasAnswer(question: SurveyQuestion, answer: AnswerValue | undefined): boolean {
  if (!answer) return false;
  switch (question.type) {
    case "secao":
      return false;
    case "texto_longo":
    case "texto_curto":
      return Boolean(answer.text?.trim());
    case "escolha_unica":
    case "multipla": {
      const choices = answer.choices ?? [];
      if (choices.length === 0) return false;
      if (choices.includes(OTHER_OPTION_ID) && !answer.other?.trim()) return choices.length > 1;
      return true;
    }
    case "escala":
      return typeof answer.number === "number";
    case "ranking":
      return (answer.ranking?.length ?? 0) > 0;
  }
}

/**
 * Limpa as respostas para o que as perguntas aceitam e devolve o primeiro
 * problema (pergunta obrigatória vazia ou fora do limite), se houver.
 */
export function sanitizeAnswers(
  questions: SurveyQuestion[],
  raw: SurveyAnswers
): { answers: SurveyAnswers; error: string | null } {
  const answers: SurveyAnswers = {};
  let error: string | null = null;
  const fail = (message: string) => {
    error ??= message;
  };

  questions.forEach((question, index) => {
    if (!isAnswerable(question)) return;
    const label = `Pergunta ${questionNumber(questions, index)}`;
    const value = raw[question.id];
    const optionIds = new Set(question.options.map((option) => option.id));
    let clean: AnswerValue | null = null;

    switch (question.type) {
      case "texto_longo":
      case "texto_curto": {
        const max = question.type === "texto_curto" ? SHORT_TEXT_MAX : TEXT_MAX;
        const text = value?.text?.trim() ?? "";
        if (text.length > max) fail(`${label}: passou de ${max} caracteres.`);
        if (text) clean = { text: text.slice(0, max) };
        break;
      }
      case "escolha_unica":
      case "multipla": {
        const allowed = (value?.choices ?? []).filter(
          (id) => optionIds.has(id) || (question.allow_other && id === OTHER_OPTION_ID)
        );
        const choices = [...new Set(allowed)];
        const other = choices.includes(OTHER_OPTION_ID) ? value?.other?.trim().slice(0, SHORT_TEXT_MAX) ?? "" : "";
        const picked = other ? choices : choices.filter((id) => id !== OTHER_OPTION_ID);
        if (question.type === "escolha_unica" && picked.length > 1) fail(`${label}: escolha só uma opção.`);
        if (question.type === "multipla" && question.max_choices && picked.length > question.max_choices) {
          fail(`${label}: escolha no máximo ${question.max_choices}.`);
        }
        if (picked.length) clean = other ? { choices: picked, other } : { choices: picked };
        break;
      }
      case "escala": {
        const number = value?.number;
        if (typeof number === "number") {
          if (number < question.scale_min || number > question.scale_max) fail(`${label}: nota fora da escala.`);
          else clean = { number };
        }
        break;
      }
      case "ranking": {
        const ranking = [...new Set((value?.ranking ?? []).filter((id) => optionIds.has(id)))];
        if (ranking.length) clean = { ranking };
        break;
      }
    }

    if (clean) answers[question.id] = clean;
    else if (question.required) fail(`${label} é obrigatória.`);
  });

  return { answers, error };
}

/** Número exibido da pergunta (as seções não contam). */
export function questionNumber(questions: SurveyQuestion[], index: number): number {
  return questions.slice(0, index + 1).filter(isAnswerable).length;
}

/* ------------------------------------------------------------------ */
/* Edição                                                              */
/* ------------------------------------------------------------------ */

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function blankQuestion(type: QuestionType): SurveyQuestion {
  const base: SurveyQuestion = {
    id: newId(),
    type,
    title: "",
    help: "",
    required: false,
    options: [],
    max_choices: null,
    allow_other: false,
    scale_min: 1,
    scale_max: 5,
    scale_min_label: "",
    scale_max_label: "",
  };
  if (type === "escolha_unica" || type === "multipla" || type === "ranking") {
    base.options = [
      { id: newId(), label: "Opção 1" },
      { id: newId(), label: "Opção 2" },
    ];
  }
  if (type === "escala") {
    base.scale_min_label = "Muito ruim";
    base.scale_max_label = "Excelente";
  }
  return base;
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export const surveyUpdateSchema = z.object({
  title: z.string().trim().min(1, "Dê um título à pesquisa.").max(160).optional(),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Link só com letras minúsculas, números e hífen.")
    .min(3)
    .max(80)
    .optional(),
  intro: z.string().max(4000).optional(),
  brand: z.enum(SURVEY_BRANDS).nullable().optional(),
  audience_departments: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
  anonymous: z.boolean().optional(),
  status: z.enum(SURVEY_STATUSES).optional(),
  closes_at: z.string().datetime({ offset: true }).nullable().optional(),
  questions: z.array(questionSchema).max(80).optional(),
});

export type SurveyUpdateInput = z.infer<typeof surveyUpdateSchema>;

/** Problemas que impedem abrir a pesquisa. */
export function surveyReadinessIssues(survey: Pick<Survey, "title" | "questions">): string[] {
  const issues: string[] = [];
  if (!survey.title.trim()) issues.push("A pesquisa está sem título.");
  if (!survey.questions.some(isAnswerable)) issues.push("Inclua pelo menos uma pergunta.");
  survey.questions.forEach((question, index) => {
    if (!question.title.trim()) issues.push(`Item ${index + 1} está sem texto.`);
    if ((question.type === "escolha_unica" || question.type === "multipla" || question.type === "ranking") && question.options.length < 2) {
      issues.push(`"${question.title || `Item ${index + 1}`}" precisa de pelo menos duas opções.`);
    }
  });
  return issues;
}

/* ------------------------------------------------------------------ */
/* Apuração                                                            */
/* ------------------------------------------------------------------ */

export interface ChoiceTally {
  id: string;
  label: string;
  count: number;
  /** Fração de quem respondeu a pergunta (0–1). */
  share: number;
}

export interface RankingTally {
  id: string;
  label: string;
  /** Pontos de Borda: 1º lugar vale n, o último vale 1. */
  points: number;
  /** Posição média de quem ordenou (1 = mais prioritário). */
  average_position: number | null;
  first_place: number;
}

export type QuestionResult =
  | { kind: "secao"; question: SurveyQuestion }
  | { kind: "texto"; question: SurveyQuestion; answered: number; texts: string[] }
  | { kind: "escolha"; question: SurveyQuestion; answered: number; options: ChoiceTally[]; others: string[] }
  | {
      kind: "escala";
      question: SurveyQuestion;
      answered: number;
      average: number | null;
      distribution: Array<{ value: number; count: number }>;
    }
  | { kind: "ranking"; question: SurveyQuestion; answered: number; options: RankingTally[] };

export function tallyQuestion(question: SurveyQuestion, responses: SurveyAnswers[]): QuestionResult {
  const answersFor = responses.map((answers) => answers[question.id]).filter((answer) => hasAnswer(question, answer)) as AnswerValue[];
  const answered = answersFor.length;

  switch (question.type) {
    case "secao":
      return { kind: "secao", question };
    case "texto_longo":
    case "texto_curto":
      return { kind: "texto", question, answered, texts: answersFor.map((answer) => answer.text!.trim()) };
    case "escolha_unica":
    case "multipla": {
      const counts = new Map<string, number>();
      for (const answer of answersFor) for (const id of answer.choices ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
      const options: ChoiceTally[] = question.options.map((option) => ({
        id: option.id,
        label: option.label,
        count: counts.get(option.id) ?? 0,
        share: answered ? (counts.get(option.id) ?? 0) / answered : 0,
      }));
      const others = answersFor.map((answer) => answer.other?.trim() ?? "").filter(Boolean);
      if (question.allow_other || others.length) {
        options.push({ id: OTHER_OPTION_ID, label: "Outro", count: others.length, share: answered ? others.length / answered : 0 });
      }
      return { kind: "escolha", question, answered, options, others };
    }
    case "escala": {
      const distribution = [];
      for (let value = question.scale_min; value <= question.scale_max; value += 1) {
        distribution.push({ value, count: answersFor.filter((answer) => answer.number === value).length });
      }
      const total = answersFor.reduce((sum, answer) => sum + (answer.number ?? 0), 0);
      return { kind: "escala", question, answered, average: answered ? total / answered : null, distribution };
    }
    case "ranking": {
      const size = question.options.length;
      const optionIds = new Set(question.options.map((option) => option.id));
      const stats = new Map(question.options.map((option) => [option.id, { points: 0, positions: [] as number[], first: 0 }]));
      for (const answer of answersFor) {
        (answer.ranking ?? [])
          .filter((id) => optionIds.has(id))
          .forEach((id, index) => {
            const stat = stats.get(id)!;
            stat.points += size - index;
            stat.positions.push(index + 1);
            if (index === 0) stat.first += 1;
          });
      }
      const options: RankingTally[] = question.options
        .map((option) => {
          const stat = stats.get(option.id)!;
          return {
            id: option.id,
            label: option.label,
            points: stat.points,
            average_position: stat.positions.length
              ? stat.positions.reduce((sum, position) => sum + position, 0) / stat.positions.length
              : null,
            first_place: stat.first,
          };
        })
        .sort((a, b) => b.points - a.points);
      return { kind: "ranking", question, answered, options };
    }
  }
}

/* ------------------------------------------------------------------ */
/* Síntese da IA                                                        */
/* ------------------------------------------------------------------ */

export const synthesisSchema = z.object({
  resumo: z.string().describe("Três a cinco frases com o retrato geral da equipe, para abrir a fala no workshop."),
  temas: z
    .array(
      z.object({
        titulo: z.string().describe("Nome curto do tema, até 6 palavras."),
        descricao: z.string().describe("O que a equipe disse sobre o tema, em uma ou duas frases."),
        mencoes: z.number().int().describe("Quantas respostas tocam no tema (estimativa honesta)."),
        citacoes: z.array(z.string()).describe("Até 2 trechos literais e curtos das respostas, sem nomes."),
      })
    )
    .describe("De 3 a 7 temas que mais aparecem, do mais citado ao menos citado."),
  por_pergunta: z
    .array(
      z.object({
        question_id: z.string(),
        sintese: z.string().describe("Uma ou duas frases com o que as respostas a esta pergunta dizem."),
      })
    )
    .describe("Uma entrada para cada pergunta aberta recebida."),
  pontos_de_atencao: z.array(z.string()).describe("Até 5 riscos, dores ou desconfortos que pedem cuidado."),
  propostas: z.array(z.string()).describe("Até 6 propostas concretas para levar ao planejamento de 2027, tiradas das respostas."),
});

export type SurveySynthesis = z.infer<typeof synthesisSchema>;

export function formatSurveyDate(value: string | null, withTime = false): string {
  if (!value) return "";
  return new Date(value).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: withTime ? undefined : "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}
