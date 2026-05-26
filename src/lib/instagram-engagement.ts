import type { InstagramPost } from "./instagram-posts";

/** Curtidas + comentários + salvamentos */
export function computeEngagementActions(
  likes: number,
  comments: number,
  saves: number
): number {
  return likes + comments + saves;
}

export function computeEngagementActionsFromPost(post: InstagramPost): number {
  return computeEngagementActions(post.likes, post.comments, post.saves);
}

/**
 * Taxa de engajamento: (curtidas + comentários + salvamentos) ÷ alcance × 100
 */
export function computeEngagementRate(
  likes: number,
  comments: number,
  saves: number,
  reach: number
): number {
  if (reach <= 0) return 0;
  const actions = computeEngagementActions(likes, comments, saves);
  return Number(((actions / reach) * 100).toFixed(2));
}

export function computePostEngagementRate(post: InstagramPost): number {
  return computeEngagementRate(post.likes, post.comments, post.saves, post.reach);
}

export function computeAggregateEngagementRate(posts: InstagramPost[]): number {
  const reach = posts.reduce((s, p) => s + p.reach, 0);
  if (reach <= 0) return 0;
  const actions = posts.reduce(
    (s, p) => s + computeEngagementActionsFromPost(p),
    0
  );
  return Number(((actions / reach) * 100).toFixed(2));
}

export const ENGAGEMENT_RATE_FORMULA =
  "(Curtidas + Comentários + Salvamentos) ÷ Alcance × 100";

export const ENGAGEMENT_ACTIONS_LABEL = "Ações de engajamento";

export const ENGAGEMENT_ACTIONS_DESCRIPTION =
  "Curtidas + comentários + salvamentos";

export const ENGAGEMENT_RATE_FORMULA_SHORT =
  "(curtidas + comentários + salvamentos) ÷ alcance × 100";

export function formatEngagementRate(rate: number): string {
  return `${rate.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}
