import {
  fetchInstagramPosts,
  fetchAccountStatsHistory,
  fetchLatestAccountStats,
  refreshAllInstagramPostTags,
} from "@/lib/instagram-posts";
import { fetchInstagramStories } from "@/lib/instagram-stories";
import { fetchInstagramMonthlyGoal, DEFAULT_MONTHLY_GOAL } from "@/lib/instagram-settings";
import { fetchAccountInsightsHistory } from "@/lib/instagram-account-insights";
import { fetchAudienceDemographics } from "@/lib/instagram-demographics";
import { fetchAreas } from "@/lib/areas";
import { fetchUsers } from "@/lib/users";
import { InstagramInsightsClient } from "@/components/instagram/instagram-insights-client";
import {
  sanitizeInstagramPostsForClient,
  sanitizeInstagramStoryForClient,
} from "@/lib/instagram-thumbnail-client";

export const dynamic = "force-dynamic";

export default async function InstagramInsightsPage() {
  let posts: Awaited<ReturnType<typeof fetchInstagramPosts>> = [];
  let accountStats: Awaited<ReturnType<typeof fetchLatestAccountStats>> = null;
  let areas: Awaited<ReturnType<typeof fetchAreas>> = [];
  let users: Awaited<ReturnType<typeof fetchUsers>> = [];
  let accountStatsHistory: Awaited<ReturnType<typeof fetchAccountStatsHistory>> = [];
  let stories: Awaited<ReturnType<typeof fetchInstagramStories>> = [];
  let monthlyGoal = DEFAULT_MONTHLY_GOAL;
  let accountInsights: Awaited<ReturnType<typeof fetchAccountInsightsHistory>> = [];
  let demographics: Awaited<ReturnType<typeof fetchAudienceDemographics>> = [];

  try {
    await refreshAllInstagramPostTags();
    [
      posts,
      accountStats,
      areas,
      users,
      accountStatsHistory,
      stories,
      monthlyGoal,
      accountInsights,
      demographics,
    ] = await Promise.all([
      fetchInstagramPosts(),
      fetchLatestAccountStats(),
      fetchAreas(),
      fetchUsers(),
      fetchAccountStatsHistory(),
      fetchInstagramStories(),
      fetchInstagramMonthlyGoal(),
      fetchAccountInsightsHistory(),
      fetchAudienceDemographics(),
    ]);
  } catch {
    // Supabase indisponível
  }

  return (
    <div className="flex flex-col gap-5 min-h-0 w-full">
      <header className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">Instagram Insights</h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Métricas da conta @bismarchipires, dashboards por área e gestão de vínculos das postagens
          sincronizadas desde 2025.
        </p>
      </header>
      <InstagramInsightsClient
        initialPosts={sanitizeInstagramPostsForClient(posts)}
        initialAccountStats={accountStats}
        initialAccountStatsHistory={accountStatsHistory}
        initialAreas={areas}
        initialUsers={users}
        initialStories={stories.map((s) =>
          sanitizeInstagramStoryForClient({
            id: s.ig_story_id,
            ig_story_id: s.ig_story_id,
            media_type: s.media_type ?? undefined,
            media_url: s.media_url ?? undefined,
            thumbnail_url: s.thumbnail_url ?? undefined,
            permalink: s.permalink ?? undefined,
            published_at: s.published_at,
            reach: s.reach,
            views: s.views,
            replies: s.replies,
            shares: s.shares,
            total_interactions: s.total_interactions,
            follows: s.follows,
            profile_visits: s.profile_visits,
            nav_taps_forward: s.nav_taps_forward,
            nav_taps_back: s.nav_taps_back,
            nav_exits: s.nav_exits,
            nav_swipe_forward: s.nav_swipe_forward,
          })
        )}
        initialMonthlyGoal={monthlyGoal}
        initialAccountInsights={accountInsights}
        initialDemographics={demographics}
      />
    </div>
  );
}
