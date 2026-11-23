/**
 * Escritórios de referência e concorrentes: o que postam no Instagram (Business
 * Discovery). A API pública não dá alcance de conta alheia, então o engajamento
 * aqui é (curtidas + comentários) ÷ seguidores — serve para comparar entre eles,
 * não com o nosso número (que é sobre alcance).
 */
import { captionHeadline } from "@/lib/content-generator/learning";

export type ReferenceKind = "referencia" | "concorrente";

export const REFERENCE_KIND_LABELS: Record<ReferenceKind, string> = {
  referencia: "Escritório de referência",
  concorrente: "Concorrente",
};

export interface ReferenceAccount {
  id: string;
  username: string;
  displayName: string | null;
  followersCount: number | null;
  mediaCount: number | null;
  profilePictureUrl: string | null;
  kind: ReferenceKind;
  focusArea: string;
  isActive: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export interface ReferencePost {
  id: string;
  accountId: string;
  caption: string | null;
  mediaType: string | null;
  mediaProductType: string | null;
  permalink: string | null;
  mediaUrl: string | null;
  publishedAt: string | null;
  likeCount: number | null;
  commentsCount: number | null;
  followersAtSync: number | null;
}

export interface ReferenceAccountRow {
  id: string;
  username: string;
  display_name: string | null;
  followers_count: number | null;
  media_count: number | null;
  profile_picture_url: string | null;
  kind: ReferenceKind;
  focus_area: string;
  is_active: boolean;
  last_synced_at: string | null;
  last_error: string | null;
}

export interface ReferencePostRow {
  id: string;
  account_id: string;
  caption: string | null;
  media_type: string | null;
  media_product_type: string | null;
  permalink: string | null;
  media_url: string | null;
  published_at: string | null;
  like_count: number | null;
  comments_count: number | null;
  followers_at_sync: number | null;
}

export function accountFromRow(row: ReferenceAccountRow): ReferenceAccount {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    followersCount: row.followers_count,
    mediaCount: row.media_count,
    profilePictureUrl: row.profile_picture_url,
    kind: row.kind,
    focusArea: row.focus_area,
    isActive: row.is_active,
    lastSyncedAt: row.last_synced_at,
    lastError: row.last_error,
  };
}

export function postFromRow(row: ReferencePostRow): ReferencePost {
  return {
    id: row.id,
    accountId: row.account_id,
    caption: row.caption,
    mediaType: row.media_type,
    mediaProductType: row.media_product_type,
    permalink: row.permalink,
    mediaUrl: row.media_url,
    publishedAt: row.published_at,
    likeCount: row.like_count,
    commentsCount: row.comments_count,
    followersAtSync: row.followers_at_sync,
  };
}

/** (curtidas + comentários) ÷ seguidores, em %. Null quando a conta esconde as curtidas. */
export function referenceEngagement(post: Pick<ReferencePost, "likeCount" | "commentsCount" | "followersAtSync">): number | null {
  if (post.likeCount === null || post.likeCount === undefined || !post.followersAtSync) return null;
  return Math.round(((post.likeCount + (post.commentsCount ?? 0)) / post.followersAtSync) * 1000) / 10;
}

export function referenceFormat(post: Pick<ReferencePost, "mediaType" | "mediaProductType">): "Carrossel" | "Reels" | "Imagem" {
  if (post.mediaProductType === "REELS" || post.mediaType === "VIDEO") return "Reels";
  if (post.mediaType === "CAROUSEL_ALBUM") return "Carrossel";
  return "Imagem";
}

export interface ReferenceSummary {
  account: ReferenceAccount;
  posts: number;
  /** Posts por semana no período analisado. */
  perWeek: number;
  avgEngagement: number | null;
  top: ReferencePost[];
  recent: ReferencePost[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function summarizeReferences(accounts: ReferenceAccount[], posts: ReferencePost[], windowDays = 90, now = new Date()): ReferenceSummary[] {
  const since = now.getTime() - windowDays * DAY_MS;
  return accounts.map((account) => {
    const own = posts
      .filter((post) => post.accountId === account.id && post.publishedAt && new Date(post.publishedAt).getTime() >= since)
      .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
    const rates = own.map(referenceEngagement).filter((rate): rate is number => rate !== null);
    return {
      account,
      posts: own.length,
      perWeek: Math.round((own.length / (windowDays / 7)) * 10) / 10,
      avgEngagement: rates.length ? Math.round((rates.reduce((sum, rate) => sum + rate, 0) / rates.length) * 10) / 10 : null,
      top: [...own].sort((a, b) => (referenceEngagement(b) ?? -1) - (referenceEngagement(a) ?? -1)).slice(0, 5),
      recent: own.slice(0, 6),
    };
  });
}

/** O que os escritórios de referência postam, em texto para a IA do aprendizado. */
export function referencesPromptBlock(summaries: ReferenceSummary[]): string {
  const withPosts = summaries.filter((summary) => summary.posts > 0);
  if (withPosts.length === 0) return "";
  return [
    "ESCRITÓRIOS DE REFERÊNCIA E CONCORRENTES (posts públicos dos últimos 90 dias; engajamento = curtidas+comentários ÷ seguidores, só comparável entre eles):",
    ...withPosts.map((summary) => {
      const { account } = summary;
      const header = `\n@${account.username} (${account.displayName ?? account.username}; ${REFERENCE_KIND_LABELS[account.kind]}${account.focusArea !== "Geral" ? `, foco ${account.focusArea}` : ""}; ${account.followersCount ?? "?"} seguidores; ${summary.perWeek} posts/semana${summary.avgEngagement !== null ? `; engajamento médio ${summary.avgEngagement}%` : ""})`;
      const lines = [...summary.top.slice(0, 4), ...summary.recent.filter((post) => !summary.top.slice(0, 4).includes(post)).slice(0, 3)].map((post) => {
        const rate = referenceEngagement(post);
        return `- [${referenceFormat(post)}${rate !== null ? `, ${rate}%` : ""}] ${captionHeadline(post.caption, 200) || "(sem legenda)"}`;
      });
      return [header, ...lines].join("\n");
    }),
  ].join("\n");
}

export function normalizeUsername(value: string): string {
  return value.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/\/.*$/, "").toLowerCase();
}
