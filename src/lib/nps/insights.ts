/** Temas, pesos e agregação dos campos abertos do NPS. Sem I/O. */

import { classifyNpsScore, type NpsBucket } from "@/lib/nps/scoring";

export const NPS_INSIGHT_TAXONOMY_VERSION = 3;

export const NPS_INSIGHT_THEME_IDS = [
  "tecnica",
  "disponibilidade",
  "comunicacao",
  "inovacao",
  "agilidade",
  "organizacao",
  "engajamento_socio",
  "relacionamento",
  "honorarios",
  "evolucao",
  "outro",
] as const;

export type NpsInsightThemeId = (typeof NPS_INSIGHT_THEME_IDS)[number];

export type NpsInsightField = "reason" | "improvement";
export type NpsInsightPolarity = "strength" | "pain" | "neutral";

export const NPS_INSIGHT_THEME_LABELS: Record<NpsInsightThemeId, string> = {
  tecnica: "Competência técnica",
  disponibilidade: "Disponibilidade",
  comunicacao: "Comunicação",
  inovacao: "Inovação",
  agilidade: "Agilidade",
  organizacao: "Organização",
  engajamento_socio: "Engajamento do sócio",
  relacionamento: "Atendimento",
  honorarios: "Honorários",
  evolucao: "Melhoria contínua",
  outro: "Outro",
};

export function isNpsInsightThemeId(value: string): value is NpsInsightThemeId {
  return (NPS_INSIGHT_THEME_IDS as readonly string[]).includes(value);
}

function foldPt(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const NOISE_EXACT = new Set([
  "nada",
  "nao",
  "na",
  "n/a",
  "ok",
  "-",
  ".",
  "nil",
  "nenhum",
  "nenhuma",
  "sem comentarios",
  "sem comentario",
  "nada a declarar",
  "nada a acrescentar",
  "nada a comentar",
  "nao tenho",
  "nao sei",
  "sem",
]);

const ASK_NEEDLES = [
  "poderia",
  "podiam",
  "deveria",
  "sugiro",
  "gostaria",
  "falt",
  "senti",
  "melhorar",
  "uma vez ao mes",
  "filial",
  "reter",
  "turnover",
  "rotatividade",
  "restrita",
  "otimizar",
  "honorario",
  "cobranca",
  "prazo",
  "dizer como",
  "plano de carreira",
  "mais experiencia",
  "sobrecarga",
  "retenc",
  "perdendo",
  "nao perder",
];

const PRAISE_NEEDLES = [
  "satisfeit",
  "parabens",
  "excelente",
  "perfeit",
  "elogio",
  "positivo",
  "nada a reclamar",
  "nao tenho sugestao",
  "otimo dialogo",
  "crescen",
  "parceria",
  "obrigad",
  "agrade",
  "confianca perene",
  "relacao de confianca",
  "relacao perfeita",
];

const PRACTICE_SHARE_NEEDLES = [
  "compartilhar uma pratica",
  "vi o pessoal",
  "grupo recente",
  "legal ai",
  "arquivo markdown",
  "markdown por cliente",
  "quando a ia ajuda",
  "redigir a peca",
  "primeiro unicornio",
];

const WEAK_DIMENSION_MAX = 7;

function foldedText(text: string): string {
  return foldPt(text).replace(/[?!.,;:😉]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Ausência de conteúdo. "Melhoria contínua" não é ruído. */
export function isNpsTextNoise(text: string | null | undefined): boolean {
  if (text == null) return true;
  const folded = foldedText(text);
  if (folded.length < 2) return true;
  if (NOISE_EXACT.has(folded)) return true;
  if (/^(nada|nao)( ha( nada)?( a melhorar)?)?( a (dizer|declarar|acrescentar|comentar))?$/.test(folded)) {
    return true;
  }
  if (/^(no momento nao|por enquanto nao)( ha nada)?$/.test(folded)) return true;
  return false;
}

export function isNpsKeepImprovingAsk(text: string): boolean {
  const folded = foldedText(text);
  return (
    folded.includes("melhoria continua") ||
    folded.includes("sempre adotar o conceito") ||
    folded.includes("continuar com a dedicacao") ||
    folded.includes("continuar evolu") ||
    folded.includes("evoluind")
  );
}

/** Relato de prática de terceiro / ferramenta — não é pedido ao escritório. */
export function isNpsPracticeShare(text: string | null | undefined): boolean {
  if (text == null) return false;
  const folded = foldedText(text);
  return PRACTICE_SHARE_NEEDLES.some((n) => folded.includes(n));
}

export function isNpsRelationshipPraise(text: string | null | undefined): boolean {
  if (text == null) return false;
  const folded = foldedText(text);
  if (folded.includes("falta") || folded.includes("nao ha confianca")) return false;
  return (
    folded.includes("confianca perene") ||
    folded.includes("relacao de confianca") ||
    folded.includes("estabelecimento de uma relacao") ||
    folded.includes("relacao perfeita")
  );
}

export function isNpsImprovementAsk(text: string | null | undefined): boolean {
  if (text == null || isNpsTextNoise(text)) return false;
  if (isNpsKeepImprovingAsk(text)) return false;
  if (isNpsPracticeShare(text)) return false;
  if (isNpsPraiseOnly(text)) return false;
  const folded = foldedText(text);
  return ASK_NEEDLES.some((n) => folded.includes(n));
}

/** Melhoria que é só elogio, sem pedido — não entra em Dores. */
export function isNpsPraiseOnly(text: string | null | undefined): boolean {
  if (text == null || isNpsTextNoise(text)) return true;
  const folded = foldedText(text);
  if (isNpsKeepImprovingAsk(text)) return false;
  if (isNpsPracticeShare(text)) return false;
  if (folded.includes("infeliz")) return false;
  if (ASK_NEEDLES.some((n) => folded.includes(n))) return false;
  if (folded.includes("impar") && !folded.includes("imparcial")) return true;
  if (folded.includes("feliz") && !folded.includes("infeliz")) return true;
  if (PRAISE_NEEDLES.some((n) => folded.includes(n))) return true;
  if (/^(nao tenho sugestao|estou muito satisfeit|experiencia foi)/.test(folded)) return true;
  return false;
}

/** Não deve ir para Dores: elogio, platitude de evoluir, ou prática compartilhada. */
export function isNpsNotPainText(text: string | null | undefined): boolean {
  if (text == null || isNpsTextNoise(text)) return true;
  if (isNpsKeepImprovingAsk(text)) return true;
  if (isNpsPracticeShare(text)) return true;
  if (isNpsRelationshipPraise(text)) return true;
  return isNpsPraiseOnly(text);
}

export interface NpsInsightThemeHit {
  id: NpsInsightThemeId;
  polarity: NpsInsightPolarity;
  quote: string;
}

export interface NpsInsightScoreContext {
  scoreAvailability: number;
  scoreCommunication: number;
  scoreInnovation: number;
  scoreTechnical: number;
}

export interface NpsInsightFieldRow {
  responseId: string;
  clientGroupId: string;
  respondentName: string;
  groupName: string;
  scoreRecommend: number;
  scoreAvailability?: number;
  scoreCommunication?: number;
  scoreInnovation?: number;
  scoreTechnical?: number;
  field: NpsInsightField;
  isNoise: boolean;
  themes: NpsInsightThemeHit[];
  actionable: boolean;
}

export interface NpsThemeQuote {
  responseId: string;
  respondentName: string;
  groupName: string;
  quote: string;
  bucket: NpsBucket;
  field: NpsInsightField;
  actionable: boolean;
  scoreRecommend: number;
  weight: number;
}

export interface NpsThemeRank {
  id: NpsInsightThemeId;
  label: string;
  /** Soma dos pesos (desempate). */
  weight: number;
  /** Maior peso de uma menção — chave de ordenação por intensidade. */
  maxWeight: number;
  mentions: number;
  groupCount: number;
  quotes: NpsThemeQuote[];
  responseIds: string[];
}

export interface NpsCampaignInsights {
  strengths: NpsThemeRank[];
  pains: NpsThemeRank[];
  classifiedFields: number;
  pendingCount: number;
  expectedCount: number;
  unavailable: boolean;
  error: string | null;
}

export function emptyNpsCampaignInsights(): NpsCampaignInsights {
  return {
    strengths: [],
    pains: [],
    classifiedFields: 0,
    pendingCount: 0,
    expectedCount: 0,
    unavailable: false,
    error: null,
  };
}

export function npsInsightProgress(insights: NpsCampaignInsights): {
  done: number;
  total: number;
  pct: number;
} {
  const total = insights.expectedCount;
  const done = Math.max(0, Math.min(total, total - insights.pendingCount));
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return { done, total, pct };
}

/**
 * Intensidade de uma menção.
 * Dores: Detrator 3; Neutro e Promotor (pedido, incl. melhoria contínua) 2.
 * Forças: 10 → 1.1; 9 → 1.
 */
export function npsInsightMentionWeight(options: {
  scoreRecommend: number;
  field: NpsInsightField;
  polarity: NpsInsightPolarity;
  isNoise: boolean;
  themeId?: NpsInsightThemeId;
  scoreAvailability?: number;
  scoreCommunication?: number;
}): number {
  if (options.isNoise) return 0;
  const bucket = classifyNpsScore(options.scoreRecommend);
  const weakAvailability =
    options.themeId === "disponibilidade" &&
    options.scoreAvailability != null &&
    options.scoreAvailability <= WEAK_DIMENSION_MAX;
  const weakCommunication =
    options.themeId === "comunicacao" &&
    options.scoreCommunication != null &&
    options.scoreCommunication <= WEAK_DIMENSION_MAX;

  if (options.polarity === "pain" && (weakAvailability || weakCommunication)) {
    return 3;
  }

  if (options.field === "improvement") {
    if (bucket === "detractor") return 3;
    return 2;
  }

  if (options.polarity === "pain") {
    if (bucket === "detractor") return 3;
    return 2;
  }

  if (options.polarity === "strength") {
    if (bucket === "promoter") return options.scoreRecommend >= 10 ? 1.1 : 1;
    if (bucket === "passive") return 0.8;
    return 0.5;
  }

  return 0;
}

export function expectedInsightFieldCount(reason: string | null | undefined, improvement: string | null | undefined): number {
  return (isNpsTextNoise(reason) ? 0 : 1) + (isNpsTextNoise(improvement) ? 0 : 1);
}

function pushRank(
  map: Map<NpsInsightThemeId, NpsThemeRank>,
  hit: NpsInsightThemeHit,
  row: NpsInsightFieldRow,
  weight: number
) {
  if (weight <= 0) return;
  const quote = (hit.quote || "").trim().slice(0, 280);
  if (!quote) return;

  let rank = map.get(hit.id);
  if (!rank) {
    rank = {
      id: hit.id,
      label: NPS_INSIGHT_THEME_LABELS[hit.id],
      weight: 0,
      maxWeight: 0,
      mentions: 0,
      groupCount: 0,
      quotes: [],
      responseIds: [],
    };
    map.set(hit.id, rank);
  }

  rank.weight += weight;
  rank.maxWeight = Math.max(rank.maxWeight, weight);
  rank.mentions += 1;
  if (!rank.responseIds.includes(row.responseId)) rank.responseIds.push(row.responseId);
  rank.quotes.push({
    responseId: row.responseId,
    respondentName: row.respondentName,
    groupName: row.groupName,
    quote,
    bucket: classifyNpsScore(row.scoreRecommend),
    field: row.field,
    actionable: row.actionable,
    scoreRecommend: row.scoreRecommend,
    weight,
  });
}

function finalizeRanks(map: Map<NpsInsightThemeId, NpsThemeRank>): NpsThemeRank[] {
  const ranks = Array.from(map.values()).map((rank) => {
    const groupNames = new Set(rank.quotes.map((q) => q.groupName));
    rank.quotes.sort((a, b) => b.weight - a.weight || b.scoreRecommend - a.scoreRecommend);
    return {
      ...rank,
      groupCount: groupNames.size,
      quotes: rank.quotes.slice(0, 3),
    };
  });

  ranks.sort(
    (a, b) =>
      b.maxWeight - a.maxWeight ||
      b.weight - a.weight ||
      b.groupCount - a.groupCount ||
      b.mentions - a.mentions
  );

  return ranks;
}

export function aggregateNpsCampaignInsights(
  rows: NpsInsightFieldRow[],
  pendingCount = 0
): NpsCampaignInsights {
  const strengths = new Map<NpsInsightThemeId, NpsThemeRank>();
  const pains = new Map<NpsInsightThemeId, NpsThemeRank>();

  for (const row of rows) {
    if (row.isNoise) continue;
    for (const hit of row.themes) {
      const weight = npsInsightMentionWeight({
        scoreRecommend: row.scoreRecommend,
        field: row.field,
        polarity: hit.polarity,
        isNoise: false,
        themeId: hit.id,
        scoreAvailability: row.scoreAvailability,
        scoreCommunication: row.scoreCommunication,
      });
      if (isNpsNotPainText(hit.quote) && hit.polarity !== "strength") {
        if (isNpsRelationshipPraise(hit.quote)) {
          pushRank(strengths, { ...hit, polarity: "strength" }, row, weight || 1);
        }
        continue;
      }
      if (row.field === "improvement") {
        if (hit.polarity === "strength") {
          pushRank(strengths, hit, row, weight);
          continue;
        }
        if (hit.polarity === "pain" && (isNpsImprovementAsk(hit.quote) || isWeakDimensionPain(hit, row))) {
          pushRank(pains, hit, row, weight);
        }
        continue;
      }
      if (hit.polarity === "strength") pushRank(strengths, hit, row, weight);
      if (hit.polarity === "pain") pushRank(pains, hit, row, weight);
    }
  }

  return {
    strengths: finalizeRanks(strengths),
    pains: finalizeRanks(pains),
    classifiedFields: rows.length,
    pendingCount,
    expectedCount: rows.length + pendingCount,
    unavailable: false,
    error: null,
  };
}

const THEME_KEYWORDS: Array<{ id: NpsInsightThemeId; needles: string[] }> = [
  { id: "tecnica", needles: ["conhecimento tecnico", "nivel tecnico", "competencia tecnica", "tecnico"] },
  {
    id: "disponibilidade",
    needles: [
      "disponibilidade",
      "disponivel",
      "acessivel",
      "sobrecarga",
      "restrita de tempo",
    ],
  },
  {
    id: "comunicacao",
    needles: [
      "comunicacao",
      "apresentacao",
      "retorno",
      "clareza",
      "dizer como",
      "uma vez ao mes",
      "status do processo",
    ],
  },
  { id: "inovacao", needles: ["inovacao", "inovador", "solucoes inovadoras"] },
  { id: "agilidade", needles: ["agilidade", "rapidez", "prazo", "celere", "providencias"] },
  { id: "organizacao", needles: ["organizacao", "eficacia", "organizado"] },
  { id: "engajamento_socio", needles: ["socio da area", "do socio", "e do socio", "o socio"] },
  { id: "relacionamento", needles: ["relacionamento", "parceria", "confianca", "trato", "atendimento", "acolhimento"] },
  { id: "honorarios", needles: ["honorario", "preco", "fatura", "cobranca"] },
  { id: "evolucao", needles: ["aprimorar", "evoluir", "evolucao"] },
];

const PAIN_THEME_NEEDLES: Array<{ id: NpsInsightThemeId; needles: string[] }> = [
  {
    id: "disponibilidade",
    needles: [
      "disponibilidade mais restrita",
      "disponibilidade restrita",
      "otimizar a comunicacao e a disponibilidade",
      "otimizar a disponibilidade",
      "sobrecarga",
      "restrita de tempo",
    ],
  },
  {
    id: "comunicacao",
    needles: [
      "otimizar a comunicacao",
      "otimizar a comunicacao e a disponibilidade",
      "uma vez ao mes",
      "dizer como",
      "status do processo",
    ],
  },
  { id: "honorarios", needles: ["cobranca", "honorario", "estrategias de cobranca"] },
  { id: "agilidade", needles: ["agilidade e mais assertividade", "demora", "prazo"] },
  { id: "tecnica", needles: ["mais experiencia"] },
];

const NEGATIVE_NEEDLES = [
  "falta",
  "ruim",
  "demora",
  "demorado",
  "pessimo",
  "insatisfat",
  "problema",
  "dificil",
  "ausencia",
  "sobrecarga",
  "restrita",
];

function isWeakDimensionPain(hit: NpsInsightThemeHit, row: NpsInsightFieldRow): boolean {
  if (hit.id === "disponibilidade" && row.scoreAvailability != null) {
    return row.scoreAvailability <= WEAK_DIMENSION_MAX;
  }
  if (hit.id === "comunicacao" && row.scoreCommunication != null) {
    return row.scoreCommunication <= WEAK_DIMENSION_MAX;
  }
  return false;
}

function themeHasPainCue(id: NpsInsightThemeId, folded: string): boolean {
  const spec = PAIN_THEME_NEEDLES.find((item) => item.id === id);
  return Boolean(spec?.needles.some((n) => folded.includes(n)));
}

export function extractHeuristicThemes(
  text: string,
  field: NpsInsightField,
  scoreRecommend: number,
  scores?: Partial<NpsInsightScoreContext>
): NpsInsightThemeHit[] {
  if (field === "improvement" && (isNpsKeepImprovingAsk(text) || isNpsPracticeShare(text))) {
    return [];
  }
  if (field === "improvement" && isNpsRelationshipPraise(text)) {
    return [{ id: "relacionamento", polarity: "strength", quote: text.trim().slice(0, 280) }];
  }
  if (field === "improvement" && isNpsPraiseOnly(text)) return [];

  const folded = foldPt(text);
  const bucket = classifyNpsScore(scoreRecommend);
  const negative = NEGATIVE_NEEDLES.some((n) => folded.includes(n));
  const quote = text.trim().slice(0, 280);
  const hits: NpsInsightThemeHit[] = [];
  const seen = new Set<NpsInsightThemeId>();

  const push = (id: NpsInsightThemeId, polarity: NpsInsightPolarity) => {
    if (seen.has(id)) return;
    seen.add(id);
    hits.push({ id, polarity, quote });
  };

  for (const theme of THEME_KEYWORDS) {
    if (!theme.needles.some((n) => folded.includes(n))) continue;
    const painCue = themeHasPainCue(theme.id, folded);
    const weak =
      (theme.id === "disponibilidade" && (scores?.scoreAvailability ?? 10) <= WEAK_DIMENSION_MAX) ||
      (theme.id === "comunicacao" && (scores?.scoreCommunication ?? 10) <= WEAK_DIMENSION_MAX);

    if (field === "improvement") {
      if (painCue || weak) push(theme.id, "pain");
      continue;
    }
    if (painCue || negative || bucket === "detractor") {
      push(theme.id, "pain");
    } else if (bucket === "promoter") {
      push(theme.id, "strength");
    }
  }

  if (field === "improvement") {
    if ((scores?.scoreAvailability ?? 10) <= WEAK_DIMENSION_MAX && folded.includes("disponib")) {
      push("disponibilidade", "pain");
    }
    if (
      (scores?.scoreCommunication ?? 10) <= WEAK_DIMENSION_MAX &&
      (folded.includes("comunic") || folded.includes("dizer como") || folded.includes("uma vez ao mes"))
    ) {
      push("comunicacao", "pain");
    }
    if (hits.length === 0 && isNpsImprovementAsk(text)) {
      if (folded.includes("filial")) push("outro", "pain");
      else if (folded.includes("turnover") || folded.includes("rotatividade") || folded.includes("plano de carreira")) {
        push("outro", "pain");
      } else {
        push("outro", "pain");
      }
    }
  }

  if (hits.length === 0 && field === "reason") {
    const polarity: NpsInsightPolarity =
      negative || bucket === "detractor" ? "pain" : bucket === "promoter" ? "strength" : "neutral";
    if (polarity !== "neutral") push("outro", polarity);
  }

  return hits;
}

export function isHeuristicActionable(text: string, field: NpsInsightField): boolean {
  if (field !== "improvement") return false;
  if (isNpsNotPainText(text)) return false;
  const folded = foldPt(text);
  return [
    "prazo",
    "socio",
    "retorno",
    "honorario",
    "preco",
    "comunic",
    "disponib",
    "dizer como",
    "uma vez ao mes",
  ].some((n) => folded.includes(n));
}
