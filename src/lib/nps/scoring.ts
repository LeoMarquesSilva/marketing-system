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
