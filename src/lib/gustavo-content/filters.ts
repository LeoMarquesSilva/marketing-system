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

export function overviewMetrics(items: GustavoContentItem[]) {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const thisWeek = items.filter((item) => new Date(item.created_at).getTime() >= weekAgo);
  const linkedinWeek = items.filter(
    (item) => item.linkedin_published_at && new Date(item.linkedin_published_at).getTime() >= weekAgo
  ).length;
  const reelWeek = items.filter(
    (item) => item.instagram_published_at && new Date(item.instagram_published_at).getTime() >= weekAgo
  ).length;

  return {
    weekCount: thisWeek.length,
    linkedinWeek,
    reelWeek,
    suggestions: items.filter((item) => item.status === "sugestao").length,
    waitingGustavo: items.filter(
      (item) => item.status === "aguardando_opiniao" || item.status === "aguardando_aprovacao"
    ).length,
    approved: items.filter((item) => item.status === "aprovado").length,
    opportunities: items
      .filter((item) => item.status === "sugestao" || item.status === "radar")
      .sort((a, b) => (b.editorial_score ?? 0) - (a.editorial_score ?? 0))
      .slice(0, 5),
  };
}
