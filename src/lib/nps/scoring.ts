/** Cálculo de NPS e médias por dimensão. */

export type NpsBucket = "promoter" | "passive" | "detractor";

export function classifyNpsScore(score: number): NpsBucket {
  if (score >= 9) return "promoter";
  if (score >= 7) return "passive";
  return "detractor";
}

export interface NpsScoreSummary {
  total: number;
  promoters: number;
  passives: number;
  detractors: number;
  /** NPS clássico: % promotores − % detratores (−100 a 100). null se sem respostas. */
  nps: number | null;
}

export function computeNpsSummary(recommendScores: number[]): NpsScoreSummary {
  const total = recommendScores.length;
  if (total === 0) {
    return { total: 0, promoters: 0, passives: 0, detractors: 0, nps: null };
  }

  let promoters = 0;
  let passives = 0;
  let detractors = 0;

  for (const score of recommendScores) {
    const bucket = classifyNpsScore(score);
    if (bucket === "promoter") promoters += 1;
    else if (bucket === "passive") passives += 1;
    else detractors += 1;
  }

  const nps = Math.round(((promoters - detractors) / total) * 100);

  return { total, promoters, passives, detractors, nps };
}

export function averageScore(scores: number[]): number | null {
  if (scores.length === 0) return null;
  const sum = scores.reduce((acc, n) => acc + n, 0);
  return Math.round((sum / scores.length) * 10) / 10;
}

export interface NpsDimensionAverages {
  recommend: number | null;
  availability: number | null;
  communication: number | null;
  innovation: number | null;
  technical: number | null;
}

export function computeDimensionAverages(responses: Array<{
  score_recommend: number;
  score_availability: number;
  score_communication: number;
  score_innovation: number;
  score_technical: number;
}>): NpsDimensionAverages {
  return {
    recommend: averageScore(responses.map((r) => r.score_recommend)),
    availability: averageScore(responses.map((r) => r.score_availability)),
    communication: averageScore(responses.map((r) => r.score_communication)),
    innovation: averageScore(responses.map((r) => r.score_innovation)),
    technical: averageScore(responses.map((r) => r.score_technical)),
  };
}

/**
 * Média das cinco escalas (0–10). Serve para ranquear grupos quando o NPS
 * clássico satura em 100 (todos promotores).
 */
export function computeFinalScore(dimensions: NpsDimensionAverages): number | null {
  const values = [
    dimensions.recommend,
    dimensions.availability,
    dimensions.communication,
    dimensions.innovation,
    dimensions.technical,
  ];
  if (values.some((value) => value == null)) return null;
  return averageScore(values as number[]);
}

export type NpsClientClass = "excelente" | "forte" | "atencao" | "critico";

export function classifyClientScore(score: number | null): NpsClientClass | null {
  if (score == null) return null;
  if (score >= 9.5) return "excelente";
  if (score >= 9) return "forte";
  if (score >= 7) return "atencao";
  return "critico";
}

export function clientClassLabel(clientClass: NpsClientClass): string {
  if (clientClass === "excelente") return "Excelente";
  if (clientClass === "forte") return "Forte";
  if (clientClass === "atencao") return "Atenção";
  return "Crítico";
}
