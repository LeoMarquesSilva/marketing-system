/** Metas oficiais de Instagram do escritório. */
export const REACH_GOAL_MONTHLY = 15000;
export const ENGAGEMENT_RATE_GOAL_PCT = 3.5;
export const POSTS_GOAL_MONTHLY = 12;
export const POSTS_GOAL_ANNUAL = 144;

/** Classifica o progresso (0-100+) em verde/amarelo/vermelho. */
export function goalStatusColor(pct: number | null): "good" | "near" | "low" | "none" {
  if (pct == null || !Number.isFinite(pct)) return "none";
  if (pct >= 100) return "good";
  if (pct >= 80) return "near";
  return "low";
}
