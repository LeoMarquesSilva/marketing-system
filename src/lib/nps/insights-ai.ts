/** Classificação de Motivo/Melhoria: LLM com fallback heurístico. */

import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { classifyNpsScore } from "@/lib/nps/scoring";
import {
  extractHeuristicThemes,
  isHeuristicActionable,
  isNpsInsightThemeId,
  isNpsKeepImprovingAsk,
  isNpsPraiseOnly,
  isNpsTextNoise,
  NPS_INSIGHT_THEME_IDS,
  NPS_INSIGHT_THEME_LABELS,
  type NpsInsightField,
  type NpsInsightFieldRow,
  type NpsInsightPolarity,
  type NpsInsightThemeHit,
} from "@/lib/nps/insights";

const fieldSchema = z.object({
  field: z.enum(["reason", "improvement"]),
  is_noise: z.boolean(),
  themes: z
    .array(
      z.object({
        id: z.enum(NPS_INSIGHT_THEME_IDS),
        polarity: z.enum(["strength", "pain", "neutral"]),
        quote: z.string(),
      })
    )
    .max(6),
  actionable: z.boolean(),
  suggested_action: z.string().nullable(),
  mentions_partner: z.boolean(),
});

const classificationSchema = z.object({
  fields: z.array(fieldSchema).min(1).max(2),
});

export interface ClassifyNpsTextsInput {
  responseId: string;
  clientGroupId: string;
  respondentName: string;
  groupName: string;
  scoreRecommend: number;
  reason: string | null;
  improvement: string | null;
}

export interface ClassifiedNpsField extends NpsInsightFieldRow {
  suggestedAction: string | null;
  mentionsPartner: boolean;
  source: "llm" | "heuristic" | "noise";
}

function openaiKey(): string | null {
  return process.env.NEXT_OPENAI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || null;
}

function heuristicField(
  input: ClassifyNpsTextsInput,
  field: NpsInsightField,
  text: string
): ClassifiedNpsField {
  const isNoise =
    isNpsTextNoise(text) || (field === "improvement" && isNpsPraiseOnly(text));
  const themes = isNoise ? [] : extractHeuristicThemes(text, field, input.scoreRecommend);
  return {
    responseId: input.responseId,
    clientGroupId: input.clientGroupId,
    respondentName: input.respondentName,
    groupName: input.groupName,
    scoreRecommend: input.scoreRecommend,
    field,
    isNoise,
    themes,
    actionable: !isNoise && isHeuristicActionable(text, field),
    suggestedAction: null,
    mentionsPartner: themes.some((t) => t.id === "engajamento_socio"),
    source: isNoise ? "noise" : "heuristic",
  };
}

function heuristicClassify(input: ClassifyNpsTextsInput): ClassifiedNpsField[] {
  const rows: ClassifiedNpsField[] = [];
  if (input.reason && !isNpsTextNoise(input.reason)) {
    rows.push(heuristicField(input, "reason", input.reason));
  } else if (input.reason && isNpsTextNoise(input.reason)) {
    rows.push(heuristicField(input, "reason", input.reason));
  }
  if (input.improvement && !isNpsTextNoise(input.improvement)) {
    rows.push(heuristicField(input, "improvement", input.improvement));
  } else if (input.improvement && isNpsTextNoise(input.improvement)) {
    rows.push(heuristicField(input, "improvement", input.improvement));
  }
  return rows;
}

function sanitizeThemes(
  themes: Array<{ id: string; polarity: string; quote: string }>,
  fallbackText: string,
  field: NpsInsightField,
  scoreRecommend: number
): NpsInsightThemeHit[] {
  const cleaned: NpsInsightThemeHit[] = [];
  for (const theme of themes) {
    if (!isNpsInsightThemeId(theme.id)) continue;
    const polarity = theme.polarity as NpsInsightPolarity;
    if (polarity !== "strength" && polarity !== "pain" && polarity !== "neutral") continue;
    const quote = (theme.quote || fallbackText).trim().slice(0, 280);
    if (!quote) continue;
    if (field === "improvement" && isNpsPraiseOnly(fallbackText)) continue;
    if (field === "improvement" && isNpsPraiseOnly(quote) && !isNpsKeepImprovingAsk(quote)) {
      continue;
    }
    cleaned.push({ id: theme.id, polarity, quote });
  }
  if (cleaned.length === 0 && !isNpsTextNoise(fallbackText)) {
    if (field === "improvement" && isNpsPraiseOnly(fallbackText)) return [];
    return extractHeuristicThemes(fallbackText, field, scoreRecommend);
  }
  return cleaned;
}

async function classifyWithLlm(input: ClassifyNpsTextsInput): Promise<ClassifiedNpsField[] | null> {
  const apiKey = openaiKey();
  if (!apiKey) return null;

  const pending: Array<{ field: NpsInsightField; text: string }> = [];
  if (input.reason) pending.push({ field: "reason", text: input.reason });
  if (input.improvement) pending.push({ field: "improvement", text: input.improvement });
  if (pending.length === 0) return [];

  const onlyNoise = pending.every((p) => isNpsTextNoise(p.text));
  if (onlyNoise) return heuristicClassify(input);

  const toClassify = pending.filter((p) => !isNpsTextNoise(p.text));
  const bucket = classifyNpsScore(input.scoreRecommend);
  const taxonomy = NPS_INSIGHT_THEME_IDS.map(
    (id) => `- ${id}: ${NPS_INSIGHT_THEME_LABELS[id]}`
  ).join("\n");

  const openai = createOpenAI({ apiKey });
  const result = await generateObject({
    abortSignal: AbortSignal.timeout(20_000),
    maxRetries: 1,
    model: openai(process.env.NPS_INSIGHTS_MODEL?.trim() || "gpt-4.1-mini"),
    schema: classificationSchema,
    schemaName: "nps_open_text_insights",
    temperature: 0.1,
    system: [
      "Você classifica comentários abertos de NPS de um escritório de advocacia.",
      "Use SOMENTE os ids de tema da taxonomia. Não invente tema.",
      "Motivo (reason) explica a nota: polarity strength (elogio) ou pain (crítica).",
      "Melhoria (improvement):",
      "- is_noise=true se for SÓ elogio, parabéns, satisfação, 'nada a acrescentar', sem pedido.",
      "- Elogio NÃO é dor. Não use polarity pain para 'parabéns', 'satisfeito', 'relação perfeita'.",
      "- polarity pain só quando houver pedido, crítica ou sugestão concreta.",
      "- 'Melhoria contínua' / 'continuar evoluindo' NÃO é ruído — tema evolucao, polarity pain.",
      "quote deve ser trecho literal DESTE campo, não do outro.",
      "engajamento_socio só se o texto citar sócio.",
      "Temas:",
      taxonomy,
    ].join("\n"),
    prompt: [
      `Faixa NPS: ${bucket} (nota ${input.scoreRecommend})`,
      ...toClassify.map((p) => `CAMPO ${p.field}:\n${p.text}`),
    ].join("\n\n"),
  });

  const byField = new Map<NpsInsightField, ClassifiedNpsField>();
  for (const item of result.object.fields) {
    const sourceText =
      item.field === "reason" ? input.reason : input.improvement;
    if (!sourceText) continue;
    const isNoise =
      item.is_noise ||
      isNpsTextNoise(sourceText) ||
      (item.field === "improvement" && isNpsPraiseOnly(sourceText));
    byField.set(item.field, {
      responseId: input.responseId,
      clientGroupId: input.clientGroupId,
      respondentName: input.respondentName,
      groupName: input.groupName,
      scoreRecommend: input.scoreRecommend,
      field: item.field,
      isNoise,
      themes: isNoise
        ? []
        : sanitizeThemes(item.themes, sourceText, item.field, input.scoreRecommend),
      actionable: isNoise ? false : item.actionable,
      suggestedAction: isNoise ? null : item.suggested_action,
      mentionsPartner: item.mentions_partner,
      source: isNoise ? "noise" : "llm",
    });
  }

  const rows: ClassifiedNpsField[] = [];
  for (const item of pending) {
    const existing = byField.get(item.field);
    rows.push(existing ?? heuristicField(input, item.field, item.text));
  }
  return rows;
}

/** Classifica os textos. Nunca lança: LLM falhou → heurística. */
export async function classifyNpsOpenTexts(
  input: ClassifyNpsTextsInput
): Promise<ClassifiedNpsField[]> {
  const pendingCount =
    (input.reason ? 1 : 0) + (input.improvement ? 1 : 0);
  if (pendingCount === 0) return [];

  try {
    const llm = await classifyWithLlm(input);
    if (llm) return llm;
  } catch (err) {
    console.error("[nps-insights] LLM falhou, usando heurística.", err);
  }
  return heuristicClassify(input);
}
