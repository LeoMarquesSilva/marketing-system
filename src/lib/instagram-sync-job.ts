import { SYNC_SINCE_DEFAULT, syncMediaPage } from "@/lib/instagram-meta";
import {
  refreshAllInstagramPostTags,
  upsertAccountStats,
  upsertInstagramPosts,
} from "@/lib/instagram-posts";

export interface InstagramSyncJobResult {
  totalSynced: number;
  pages: number;
  tagsUpdated: number;
  since: string;
  account: {
    username: string;
    followers_count: number;
    media_count: number;
  };
}

export async function runFullInstagramSync(
  since: string = SYNC_SINCE_DEFAULT
): Promise<InstagramSyncJobResult> {
  let after: string | undefined;
  let totalSynced = 0;
  let pages = 0;
  let accountStats: InstagramSyncJobResult["account"] | null = null;

  while (true) {
    pages += 1;
    const result = await syncMediaPage(since, after);

    if (pages === 1) {
      await upsertAccountStats(result.account);
      accountStats = {
        username: result.account.username,
        followers_count: result.account.followers_count,
        media_count: result.account.media_count,
      };
    }

    totalSynced += await upsertInstagramPosts(
      result.posts.map((p) => ({
        id: p.id,
        caption: p.caption,
        media_type: p.media_type,
        media_url: p.media_url,
        thumbnail_url: p.thumbnail_url,
        permalink: p.permalink,
        published_at: p.published_at,
        likes: p.likes,
        comments: p.comments,
        reach: p.reach,
        views: p.views,
        saves: p.saves,
        shares: p.shares,
        total_interactions: p.total_interactions,
      }))
    );

    if (!result.hasMore || !result.nextAfter) break;
    after = result.nextAfter;
  }

  const tagsUpdated = await refreshAllInstagramPostTags();

  if (!accountStats) {
    throw new Error("Nenhum dado da conta Instagram retornado na sincronização.");
  }

  return {
    totalSynced,
    pages,
    tagsUpdated,
    since,
    account: accountStats,
  };
}
