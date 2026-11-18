/**
 * Configurações do Gerador de conteúdo (uma linha em content_generator_settings).
 * Campo de texto vazio = usa o padrão do sistema, que fica visível na tela.
 */
import { LEGAL_AREAS } from "@/lib/content-areas";

export const CONTENT_SETTINGS_PATH = "/conteudo/configuracoes";

export interface GeneratorSettings {
  voiceInstructions: string;
  slideCount: number;
  defaultCta: string;
  avoidRules: string;
  /** Nota mínima (0–10) para a matéria virar carrossel; abaixo disso a IA nem escreve. */
  minRelevance: number;
  /** Quantos carrosséis no máximo por busca. */
  maxPerRun: number;
  /** Usa o aprendizado (Instagram + escolhas + edições) na nota e no texto. */
  useLearning: boolean;
  /**
   * Linha editorial por área (público, nível, o que não explicar). Prevalece sobre
   * o aprendizado. Ex.: Reestruturação "subir a prateleira" (pedido do Ricardo, 18/11/2026).
   */
  areaGuidelines: Record<string, string>;
  updatedByName: string | null;
  updatedAt: string | null;
}

export const DEFAULT_VOICE =
  "Linguagem acessível, objetiva e com tom profissional, de escritório de advocacia empresarial. " +
  "Explique o impacto prático para empresas e gestores, com exemplo concreto quando a notícia permitir. " +
  "Frases curtas, sem juridiquês desnecessário.";

export const DEFAULT_CTA = "Procure um advogado especializado.";

export const DEFAULT_AVOID =
  "Não invente fatos que não estejam na notícia. Não cite diretamente o veículo de imprensa. " +
  "Não prometa resultado em processo nem dê conselho jurídico individual.";

export const DEFAULT_SETTINGS: GeneratorSettings = {
  voiceInstructions: "",
  slideCount: 5,
  defaultCta: "",
  avoidRules: "",
  minRelevance: 4,
  // Mesmo volume que a busca diária do n8n pedia (maxCreated 15) antes desta tela existir.
  maxPerRun: 15,
  useLearning: true,
  areaGuidelines: {},
  updatedByName: null,
  updatedAt: null,
};

/** Só áreas jurídicas conhecidas e texto limitado; área vazia sai do mapa. */
export function normalizeAreaGuidelines(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const result: Record<string, string> = {};
  for (const area of LEGAL_AREAS) {
    const text = (value as Record<string, unknown>)[area];
    if (typeof text === "string" && text.trim()) result[area] = text.trim().slice(0, 2000);
  }
  return result;
}

export interface GeneratorSettingsRow {
  voice_instructions?: string | null;
  slide_count?: number | null;
  default_cta?: string | null;
  avoid_rules?: string | null;
  min_relevance?: number | null;
  max_per_run?: number | null;
  use_learning?: boolean | null;
  area_guidelines?: unknown;
  updated_by_name?: string | null;
  updated_at?: string | null;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function settingsFromRow(row: GeneratorSettingsRow | null | undefined): GeneratorSettings {
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    voiceInstructions: row.voice_instructions?.trim() ?? "",
    slideCount: clampInt(row.slide_count, 3, 10, DEFAULT_SETTINGS.slideCount),
    defaultCta: row.default_cta?.trim() ?? "",
    avoidRules: row.avoid_rules?.trim() ?? "",
    minRelevance: clampInt(row.min_relevance, 0, 10, DEFAULT_SETTINGS.minRelevance),
    maxPerRun: clampInt(row.max_per_run, 1, 40, DEFAULT_SETTINGS.maxPerRun),
    useLearning: row.use_learning ?? true,
    areaGuidelines: normalizeAreaGuidelines(row.area_guidelines),
    updatedByName: row.updated_by_name ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

/** Valida o que vem da tela e devolve as colunas a gravar. */
export function settingsToRow(input: Partial<GeneratorSettings>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.voiceInstructions !== undefined) row.voice_instructions = String(input.voiceInstructions).slice(0, 2000).trim();
  if (input.defaultCta !== undefined) row.default_cta = String(input.defaultCta).slice(0, 300).trim();
  if (input.avoidRules !== undefined) row.avoid_rules = String(input.avoidRules).slice(0, 2000).trim();
  if (input.slideCount !== undefined) row.slide_count = clampInt(input.slideCount, 3, 10, DEFAULT_SETTINGS.slideCount);
  if (input.minRelevance !== undefined) row.min_relevance = clampInt(input.minRelevance, 0, 10, DEFAULT_SETTINGS.minRelevance);
  if (input.maxPerRun !== undefined) row.max_per_run = clampInt(input.maxPerRun, 1, 40, DEFAULT_SETTINGS.maxPerRun);
  if (input.useLearning !== undefined) row.use_learning = Boolean(input.useLearning);
  if (input.areaGuidelines !== undefined) row.area_guidelines = normalizeAreaGuidelines(input.areaGuidelines);
  return row;
}

export function effectiveVoice(settings: GeneratorSettings): string {
  return settings.voiceInstructions || DEFAULT_VOICE;
}

export function effectiveCta(settings: GeneratorSettings): string {
  return settings.defaultCta || DEFAULT_CTA;
}

export function effectiveAvoid(settings: GeneratorSettings): string {
  return settings.avoidRules || DEFAULT_AVOID;
}
