/** Temas, pesos e agregação dos campos abertos do NPS. Sem I/O. */

import { classifyNpsScore, type NpsBucket } from "@/lib/nps/scoring";

export const NPS_INSIGHT_TAXONOMY_VERSION = 2;

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
  "melhoria continua",
  "sempre adotar",
  "continuar com",
  "uma vez ao mes",
  "filial",
  "reter",
  "turnover",
  "rotatividade",
  "restrita",
  "otimizar",
  "adotar",
  "rastreab",
  "honorario",
  "cobranca",
  "prazo",
  "dizer como",
  "plano de carreira",
  "mais experiencia",
  "sobrecarga",
  "retenc",
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
];

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
    folded.includes("sempre adotar") ||
    folded.includes("continuar com a dedicacao") ||
    folded.includes("continuar evolu") ||
    folded.includes("evoluind")
  );
}

/** Melhoria que é só elogio, sem pedido — não entra em Dores. */
export function isNpsPraiseOnly(text: string | null | undefined): boolean {
  if (text == null || isNpsTextNoise(text)) return true;
  const folded = foldedText(text);
  if (isNpsKeepImprovingAsk(text)) return false;
  if (folded.includes("infeliz")) return false;
  if (ASK_NEEDLES.some((n) => folded.includes(n))) return false;
  if (folded.includes("impar") && !folded.includes("imparcial")) return true;
  if (folded.includes("feliz") && !folded.includes("infeliz")) return true;
  if (PRAISE_NEEDLES.some((n) => folded.includes(n))) return true;
  if (/^(nao tenho sugestao|estou muito satisfeit|experiencia foi)/.test(folded)) return true;
  return false;
}

export interface NpsInsightThemeHit {
  id: NpsInsightThemeId;
  polarity: NpsInsightPolarity;
  quote: string;
}

export interface NpsInsightFieldRow {
  responseId: string;
  clientGroupId: string;
  respondentName: string;
  groupName: string;
  scoreRecommend: number;
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
}): number {
  if (options.isNoise) return 0;
  const bucket = classifyNpsScore(options.scoreRecommend);

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
      });
      if (row.field === "improvement") {
        if (isNpsPraiseOnly(hit.quote)) continue;
        const keepImproving = hit.id === "evolucao" && isNpsKeepImprovingAsk(hit.quote);
        if (hit.polarity === "pain" || keepImproving) {
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
  { id: "disponibilidade", needles: ["disponibilidade", "disponivel", "acessivel"] },
  { id: "comunicacao", needles: ["comunicacao", "apresentacao", "retorno", "clareza"] },
  { id: "inovacao", needles: ["inovacao", "inovador", "solucoes inovadoras"] },
  { id: "agilidade", needles: ["agilidade", "rapidez", "prazo", "celere", "providencias"] },
  { id: "organizacao", needles: ["organizacao", "eficacia", "organizado"] },
  { id: "engajamento_socio", needles: ["socio da area", "do socio", "e do socio", "o socio"] },
  { id: "relacionamento", needles: ["relacionamento", "parceria", "confianca", "trato", "atendimento", "acolhimento"] },
  { id: "honorarios", needles: ["honorario", "preco", "fatura", "cobranca"] },
  { id: "evolucao", needles: ["melhoria continua", "melhorar", "aprimorar", "evoluir", "evolucao"] },
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
];

export function extractHeuristicThemes(
  text: string,
  field: NpsInsightField,
  scoreRecommend: number
): NpsInsightThemeHit[] {
  if (field === "improvement" && isNpsPraiseOnly(text)) return [];

  const folded = foldPt(text);
  const bucket = classifyNpsScore(scoreRecommend);
  const negative = NEGATIVE_NEEDLES.some((n) => folded.includes(n));
  let polarity: NpsInsightPolarity;
  if (field === "improvement") {
    polarity = "pain";
  } else if (negative || bucket === "detractor") {
    polarity = "pain";
  } else if (bucket === "promoter") {
    polarity = "strength";
  } else {
    polarity = "neutral";
  }

  const hits: NpsInsightThemeHit[] = [];
  for (const theme of THEME_KEYWORDS) {
    if (theme.needles.some((n) => folded.includes(n))) {
      hits.push({ id: theme.id, polarity, quote: text.trim().slice(0, 280) });
    }
  }

  if (hits.length === 0 && field === "improvement" && isNpsKeepImprovingAsk(text)) {
    hits.push({ id: "evolucao", polarity: "pain", quote: text.trim().slice(0, 280) });
  }

  if (hits.length === 0 && field === "reason" && polarity !== "neutral") {
    hits.push({ id: "outro", polarity, quote: text.trim().slice(0, 280) });
  }

  return hits;
}

export function isHeuristicActionable(text: string, field: NpsInsightField): boolean {
  if (field !== "improvement") return false;
  const folded = foldPt(text);
  if (folded.includes("melhoria continua")) return false;
  return [
    "prazo",
    "socio",
    "retorno",
    "honorario",
    "preco",
    "comunic",
    "disponib",
  ].some((n) => folded.includes(n));
}
