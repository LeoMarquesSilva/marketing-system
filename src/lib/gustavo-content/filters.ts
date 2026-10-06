import type { GustavoContentItem } from "@/lib/gustavo-content/types";

export function filterRadarItems(
  items: GustavoContentItem[],
  filters: {
    status?: string;
    topicId?: string;
    channel?: string;
    thesis?: string;
    query?: string;
    minScore?: number;
  }
) {
  return items.filter((item) => {
    if (filters.status && item.status !== filters.status) return false;
    if (filters.topicId && item.topic_id !== filters.topicId) return false;
    if (filters.minScore != null && (item.editorial_score ?? 0) < filters.minScore) return false;
    if (
      filters.channel === "linkedin" &&
      item.recommended_channels?.linkedin.recommended !== true
    ) {
      return false;
    }
    if (filters.channel === "reel" && item.recommended_channels?.instagramReel.recommended !== true) {
      return false;
    }
    if (filters.thesis === "with" && !item.thesis_id) return false;
    if (filters.thesis === "without" && item.thesis_id) return false;
    if (filters.query) {
      const blob = `${item.title ?? ""} ${item.business_problem ?? ""}`.toLowerCase();
      if (!blob.includes(filters.query.toLowerCase())) return false;
    }
    return true;
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

function byScoreDesc(a: GustavoContentItem, b: GustavoContentItem) {
  return (b.editorial_score ?? 0) - (a.editorial_score ?? 0);
}

function byNewest(a: GustavoContentItem, b: GustavoContentItem) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

export type RadarSort = "recent" | "score";

/** Ordena o radar: por padrão as que entraram por último vêm primeiro; empate desfeito pela nota. */
export function sortRadarItems(items: GustavoContentItem[], sort: RadarSort = "recent") {
  return [...items].sort((a, b) =>
    sort === "recent" ? byNewest(a, b) || byScoreDesc(a, b) : byScoreDesc(a, b) || byNewest(a, b)
  );
}

export function overviewMetrics(items: GustavoContentItem[], now = Date.now()) {
  const weekAgo = now - 7 * DAY_MS;
  const thisWeek = items.filter((item) => new Date(item.created_at).getTime() >= weekAgo);
  const linkedinWeek = items.filter(
    (item) => item.linkedin_published_at && new Date(item.linkedin_published_at).getTime() >= weekAgo
  ).length;
  const reelWeek = items.filter(
    (item) => item.instagram_published_at && new Date(item.instagram_published_at).getTime() >= weekAgo
  ).length;

  // Prioriza as pautas da semana; só completa com antigas se faltar.
  const open = items.filter((item) => item.status === "sugestao" || item.status === "radar");
  const isThisWeek = (item: GustavoContentItem) => new Date(item.created_at).getTime() >= weekAgo;
  const opportunities = [
    ...open.filter(isThisWeek).sort(byScoreDesc),
    ...open.filter((item) => !isThisWeek(item)).sort(byScoreDesc),
  ].slice(0, 5);

  return {
    weekCount: thisWeek.length,
    linkedinWeek,
    reelWeek,
    suggestions: items.filter((item) => item.status === "sugestao").length,
    waitingGustavo: items.filter(
      (item) => item.status === "aguardando_opiniao" || item.status === "aguardando_aprovacao"
    ).length,
    approved: items.filter((item) => item.status === "aprovado").length,
    opportunities,
  };
}
