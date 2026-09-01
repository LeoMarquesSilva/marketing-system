import {
  SCORE_DISCARD_BELOW,
  SCORE_MAX,
  SCORE_SUGGESTION_FROM,
  type GustavoContentStatus,
} from "@/lib/gustavo-content/constants";

export type ScoreBreakdown = {
  icpRelevance: number;
  thesisPotential: number;
  businessImpact: number;
  thesisFit: number;
  freshness: number;
  differentiation: number;
  sourceQuality: number;
};

export function shouldPersistScore(score: number): boolean {
  return score >= SCORE_DISCARD_BELOW;
}

export function statusFromScore(score: number): GustavoContentStatus | null {
  if (!shouldPersistScore(score)) return null;
  if (score >= SCORE_SUGGESTION_FROM) return "sugestao";
  return "radar";
}

function clamp(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(max, Math.round(value)));
}

export function clampScoreBreakdown(raw: Partial<ScoreBreakdown>): {
  total: number;
  breakdown: ScoreBreakdown;
} {
  const breakdown: ScoreBreakdown = {
    icpRelevance: clamp(Number(raw.icpRelevance ?? 0), SCORE_MAX.icpRelevance),
    thesisPotential: clamp(Number(raw.thesisPotential ?? 0), SCORE_MAX.thesisPotential),
    businessImpact: clamp(Number(raw.businessImpact ?? 0), SCORE_MAX.businessImpact),
    thesisFit: clamp(Number(raw.thesisFit ?? 0), SCORE_MAX.thesisFit),
    freshness: clamp(Number(raw.freshness ?? 0), SCORE_MAX.freshness),
    differentiation: clamp(Number(raw.differentiation ?? 0), SCORE_MAX.differentiation),
    sourceQuality: clamp(Number(raw.sourceQuality ?? 0), SCORE_MAX.sourceQuality),
  };
  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  return { total, breakdown };
}

export function scoreBandLabel(score: number | null | undefined): string {
  if (score == null) return "Sem score";
  if (score >= 90) return "Excelente";
  if (score >= 80) return "Muito forte";
  if (score >= 70) return "Boa oportunidade";
  if (score >= 55) return "Radar";
  return "Descartada";
}

export const SCORE_CRITERIA: Array<{ key: keyof ScoreBreakdown; label: string; max: number }> = [
  { key: "icpRelevance", label: "Relevância para ICP", max: SCORE_MAX.icpRelevance },
  { key: "thesisPotential", label: "Potencial de tese", max: SCORE_MAX.thesisPotential },
  { key: "businessImpact", label: "Impacto empresarial", max: SCORE_MAX.businessImpact },
  { key: "thesisFit", label: "Aderência às teses", max: SCORE_MAX.thesisFit },
  { key: "freshness", label: "Atualidade", max: SCORE_MAX.freshness },
  { key: "differentiation", label: "Diferenciação", max: SCORE_MAX.differentiation },
  { key: "sourceQuality", label: "Qualidade das fontes", max: SCORE_MAX.sourceQuality },
];
