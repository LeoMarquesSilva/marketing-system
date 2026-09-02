import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import {
  GUSTAVO_CONTENT_MODEL_REVIEW,
  GUSTAVO_CONTENT_MODEL_SCORE,
  GUSTAVO_CONTENT_MODEL_WRITING,
} from "@/lib/gustavo-content/constants";
import { GustavoContentError } from "@/lib/gustavo-content/errors";
import {
  ANGLES_INSTRUCTIONS,
  COMPLIANCE_INSTRUCTIONS,
  EDITORIAL_BRIEF_INSTRUCTIONS,
  EDITORIAL_REVIEW_INSTRUCTIONS,
  GUSTAVO_EDITOR_SYSTEM,
  LINKEDIN_CONTENT_INSTRUCTIONS,
  REEL_CONTENT_INSTRUCTIONS,
  SCORE_INSTRUCTIONS,
} from "@/lib/gustavo-content/prompts";
import {
  anglesObjectSchema,
  complianceObjectSchema,
  contentObjectSchema,
  editorialReviewObjectSchema,
  scoreObjectSchema,
} from "@/lib/gustavo-content/schemas";
import { clampScoreBreakdown } from "@/lib/gustavo-content/score";
import { normalizeCompliance } from "@/lib/gustavo-content/compliance";
import { assembleLinkedInPost } from "@/lib/gustavo-content/text";
import type { GustavoThesis } from "@/lib/gustavo-content/theses";
import type { GustavoVoiceSample } from "@/lib/gustavo-content/voice";
import {
  buildEditorialHistoryPrompt,
  type EditorialHistoryAssessment,
} from "@/lib/gustavo-content/history";
import type { SourceContext } from "@/lib/gustavo-content/types";
import {
  buildStrategyPrompt,
  type GustavoStrategy,
} from "@/lib/gustavo-content/strategy";

function getOpenAI() {
  const apiKey = process.env.NEXT_OPENAI_API_KEY;
  if (!apiKey) {
    throw new GustavoContentError("NEXT_OPENAI_API_KEY não configurada.", 503);
  }
  return createOpenAI({ apiKey });
}

function scoreModel() {
  return getOpenAI()(GUSTAVO_CONTENT_MODEL_SCORE);
}

function writingModel() {
  return getOpenAI()(GUSTAVO_CONTENT_MODEL_WRITING);
}

function reviewModel() {
  return getOpenAI()(GUSTAVO_CONTENT_MODEL_REVIEW);
}

function thesesBlock(theses: GustavoThesis[]): string {
  if (theses.length === 0) return "Nenhuma tese cadastrada.";
  return theses
    .map(
      (thesis) =>
        `- id=${thesis.id} status=${thesis.status} [${thesis.conviction}] ${thesis.title}: ${thesis.thesis}`
    )
    .join("\n");
}

function voiceBlock(samples: GustavoVoiceSample[]): string {
  if (samples.length === 0) return "Nenhuma amostra de voz.";
  return samples
    .slice(0, 6)
    .map((sample) => sample.original_text.slice(0, 700))
    .join("\n---\n");
}

export interface AnalyzeInput {
  title: string;
  snippet: string;
  article: string;
  link: string | null;
  theses: GustavoThesis[];
  strategy: GustavoStrategy;
}

export async function analyzeScore(input: AnalyzeInput) {
  const result = await generateObject({
    model: scoreModel(),
    schema: scoreObjectSchema,
    schemaName: "gustavo_editorial_score",
    system: `${GUSTAVO_EDITOR_SYSTEM}\n\n${SCORE_INSTRUCTIONS}`,
    prompt: [
      `TÍTULO: ${input.title}`,
      `RESUMO: ${input.snippet}`,
      `MATÉRIA: ${input.article || "(não disponível — use título e resumo)"}`,
      `LINK: ${input.link ?? "—"}`,
      `ESTRATEGIA_DE_POSICIONAMENTO:\n${buildStrategyPrompt(input.strategy)}`,
      `BIBLIOTECA_DE_TESES:\n${thesesBlock(input.theses)}`,
    ].join("\n\n"),
    temperature: 0.2,
  });

  const clamped = clampScoreBreakdown(result.object.breakdown);
  return {
    total: clamped.total,
    breakdown: clamped.breakdown,
    reason: result.object.reason,
    businessProblem: result.object.businessProblem,
    sourceContext: result.object.sourceContext,
    recommendedChannels: result.object.recommendedChannels,
  };
}

export async function generateAngles(input: AnalyzeInput) {
  const result = await generateObject({
    model: scoreModel(),
    schema: anglesObjectSchema,
    schemaName: "gustavo_editorial_angles",
    system: `${GUSTAVO_EDITOR_SYSTEM}\n\n${ANGLES_INSTRUCTIONS}`,
    prompt: [
      `TÍTULO: ${input.title}`,
      `RESUMO: ${input.snippet}`,
      `MATÉRIA: ${input.article || "(não disponível)"}`,
      `ESTRATEGIA_DE_POSICIONAMENTO:\n${buildStrategyPrompt(input.strategy)}`,
      `BIBLIOTECA_DE_TESES:\n${thesesBlock(input.theses)}`,
    ].join("\n\n"),
    temperature: 0.35,
  });
  return result.object;
}

export async function generateEditorialContent(input: {
  title: string;
  snippet: string;
  article: string;
  link: string | null;
  businessProblem: string | null;
  selectedAngle: unknown;
  thesisSnapshot: string | null;
  answers: string[] | null;
  questions: string[] | null;
  theses: GustavoThesis[];
  voice: GustavoVoiceSample[];
  history: EditorialHistoryAssessment;
  sourceContext: SourceContext | null;
  strategy: GustavoStrategy;
  /** Sem opinião validada: escrever como leitura analítica, nunca em primeira pessoa. */
  factualOnly?: boolean;
  /** Problemas apontados pela revisão editorial anterior, para uma única rodada de correção. */
  reviewFeedback?: string[] | null;
}) {
  const result = await generateObject({
    model: writingModel(),
    schema: contentObjectSchema,
    schemaName: "gustavo_editorial_content",
    system: `${GUSTAVO_EDITOR_SYSTEM}\n\n${EDITORIAL_BRIEF_INSTRUCTIONS}\n\n${LINKEDIN_CONTENT_INSTRUCTIONS}\n\n${REEL_CONTENT_INSTRUCTIONS}`,
    prompt: [
      `TÍTULO: ${input.title}`,
      `RESUMO: ${input.snippet}`,
      `MATÉRIA: ${input.article || "(não disponível)"}`,
      `FATOS_DA_FONTE:\n${(input.sourceContext?.facts ?? []).map((fact) => `- ${fact}`).join("\n") || "—"}`,
      `NÚMEROS_DA_FONTE:\n${(input.sourceContext?.numbers ?? []).map((number) => `- ${number}`).join("\n") || "—"}`,
      `EMPRESAS_E_DATAS: ${(input.sourceContext?.companies ?? []).join(", ") || "—"} | ${(input.sourceContext?.dates ?? []).join(", ") || "—"}`,
      `FONTES: ${(input.sourceContext?.sourceUrls ?? []).join(" | ") || input.link || "—"}`,
      `LINK: ${input.link ?? "—"}`,
      `ESTRATEGIA_DE_POSICIONAMENTO:\n${buildStrategyPrompt(input.strategy)}`,
      `PROBLEMA_EMPRESARIAL: ${input.businessProblem ?? "—"}`,
      `ANGULO_SELECIONADO: ${JSON.stringify(input.selectedAngle ?? null)}`,
      `TESE: ${input.thesisSnapshot ?? "—"}`,
      `PERGUNTAS: ${(input.questions ?? []).join(" | ") || "—"}`,
      `RESPOSTAS_DO_GUSTAVO: ${(input.answers ?? []).join(" | ") || "—"}`,
      input.factualOnly
        ? "MODO: factual — não há opinião validada do Gustavo. Escreva análise factual e interpretação de mercado, sem atribuir a ele experiências, opiniões pessoais ou aprovação. Não escreva em primeira pessoa como se fosse ele falando."
        : "MODO: opinião — há opinião validada do Gustavo (tese ou respostas). Pode escrever em primeira pessoa quando apoiado por ela.",
      `BIBLIOTECA_DE_TESES:\n${thesesBlock(input.theses)}`,
      `VOZ_HISTORICA_GUSTAVO:\n${voiceBlock(input.voice)}`,
      `HISTORICO_EDITORIAL_GUSTAVO:\n${buildEditorialHistoryPrompt(input.history)}`,
      input.reviewFeedback?.length
        ? `REVISAO_EDITORIAL_ANTERIOR (corrija sem perder a tese e os fatos já usados):\n${input.reviewFeedback.map((issue) => `- ${issue}`).join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    temperature: 0.55,
    // O objeto ficou mais pesado (brief + linkedin estruturado + reel + 3 hooks);
    // um teto explícito evita truncamento silencioso da saída estruturada.
    maxOutputTokens: 4000,
  });

  return {
    linkedinPost: assembleLinkedInPost(result.object.linkedin),
    alternativeHooks: result.object.alternativeHooks,
    reel: result.object.reel,
    editorialBrief: result.object.editorialBrief,
    angleAlignment: result.object.angleAlignment,
  };
}

export async function reviewEditorialContent(input: {
  linkedinPost: string;
  centralThesis: string;
}) {
  const result = await generateObject({
    model: reviewModel(),
    schema: editorialReviewObjectSchema,
    schemaName: "gustavo_editorial_review",
    system: `${GUSTAVO_EDITOR_SYSTEM}\n\n${EDITORIAL_REVIEW_INSTRUCTIONS}`,
    prompt: `TESE_CENTRAL: ${input.centralThesis}\n\nLINKEDIN:\n${input.linkedinPost}`,
    temperature: 0.1,
  });
  return result.object;
}

export async function analyzeCompliance(input: {
  linkedinPost: string;
  reelScript: string;
}) {
  const result = await generateObject({
    model: reviewModel(),
    schema: complianceObjectSchema,
    schemaName: "gustavo_compliance",
    system: `${GUSTAVO_EDITOR_SYSTEM}\n\n${COMPLIANCE_INSTRUCTIONS}`,
    prompt: `LINKEDIN:\n${input.linkedinPost}\n\nREEL:\n${input.reelScript}`,
    temperature: 0.1,
  });
  return normalizeCompliance(result.object);
}
