import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { GUSTAVO_CONTENT_MODEL } from "@/lib/gustavo-content/constants";
import { GustavoContentError } from "@/lib/gustavo-content/errors";
import {
  ANGLES_INSTRUCTIONS,
  COMPLIANCE_INSTRUCTIONS,
  CONTENT_INSTRUCTIONS,
  GUSTAVO_EDITOR_SYSTEM,
  SCORE_INSTRUCTIONS,
} from "@/lib/gustavo-content/prompts";
import {
  anglesObjectSchema,
  complianceObjectSchema,
  contentObjectSchema,
  scoreObjectSchema,
} from "@/lib/gustavo-content/schemas";
import { clampScoreBreakdown } from "@/lib/gustavo-content/score";
import { normalizeCompliance } from "@/lib/gustavo-content/compliance";
import type { GustavoThesis } from "@/lib/gustavo-content/theses";
import type { GustavoVoiceSample } from "@/lib/gustavo-content/voice";
import type { EditorialHistoryAssessment } from "@/lib/gustavo-content/history";

function getOpenAI() {
  const apiKey = process.env.NEXT_OPENAI_API_KEY;
  if (!apiKey) {
    throw new GustavoContentError("NEXT_OPENAI_API_KEY não configurada.", 503);
  }
  return createOpenAI({ apiKey });
}

function model() {
  return getOpenAI()(GUSTAVO_CONTENT_MODEL);
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
}

export async function analyzeScore(input: AnalyzeInput) {
  const result = await generateObject({
    model: model(),
    schema: scoreObjectSchema,
    schemaName: "gustavo_editorial_score",
    system: `${GUSTAVO_EDITOR_SYSTEM}\n\n${SCORE_INSTRUCTIONS}`,
    prompt: [
      `TÍTULO: ${input.title}`,
      `RESUMO: ${input.snippet}`,
      `MATÉRIA: ${input.article || "(não disponível — use título e resumo)"}`,
      `LINK: ${input.link ?? "—"}`,
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
    model: model(),
    schema: anglesObjectSchema,
    schemaName: "gustavo_editorial_angles",
    system: `${GUSTAVO_EDITOR_SYSTEM}\n\n${ANGLES_INSTRUCTIONS}`,
    prompt: [
      `TÍTULO: ${input.title}`,
      `RESUMO: ${input.snippet}`,
      `MATÉRIA: ${input.article || "(não disponível)"}`,
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
}) {
  const result = await generateObject({
    model: model(),
    schema: contentObjectSchema,
    schemaName: "gustavo_editorial_content",
    system: `${GUSTAVO_EDITOR_SYSTEM}\n\n${CONTENT_INSTRUCTIONS}`,
    prompt: [
      `TÍTULO: ${input.title}`,
      `RESUMO: ${input.snippet}`,
      `MATÉRIA: ${input.article || "(não disponível)"}`,
      `LINK: ${input.link ?? "—"}`,
      `PROBLEMA_EMPRESARIAL: ${input.businessProblem ?? "—"}`,
      `ANGULO_SELECIONADO: ${JSON.stringify(input.selectedAngle ?? null)}`,
      `TESE: ${input.thesisSnapshot ?? "—"}`,
      `PERGUNTAS: ${(input.questions ?? []).join(" | ") || "—"}`,
      `RESPOSTAS_DO_GUSTAVO: ${(input.answers ?? []).join(" | ") || "—"}`,
      `BIBLIOTECA_DE_TESES:\n${thesesBlock(input.theses)}`,
      `VOZ_HISTORICA_GUSTAVO:\n${voiceBlock(input.voice)}`,
      `HISTORICO_EDITORIAL_GUSTAVO: risco=${input.history.similarityRisk}. ${input.history.reason}`,
      input.history.varyAngle
        ? "OBRIGATÓRIO: variar o ângulo em relação ao histórico."
        : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    temperature: 0.55,
  });
  return result.object;
}

export async function analyzeCompliance(input: {
  linkedinPost: string;
  reelScript: string;
}) {
  const result = await generateObject({
    model: model(),
    schema: complianceObjectSchema,
    schemaName: "gustavo_compliance",
    system: `${GUSTAVO_EDITOR_SYSTEM}\n\n${COMPLIANCE_INSTRUCTIONS}`,
    prompt: `LINKEDIN:\n${input.linkedinPost}\n\nREEL:\n${input.reelScript}`,
    temperature: 0.1,
  });
  return normalizeCompliance(result.object);
}
