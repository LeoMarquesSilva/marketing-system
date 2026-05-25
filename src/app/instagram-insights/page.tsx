import {
  fetchInstagramPosts,
  fetchLatestAccountStats,
  refreshAllInstagramPostTags,
} from "@/lib/instagram-posts";
import { fetchAreas } from "@/lib/areas";
import { fetchActiveUsers } from "@/lib/users";
import { InstagramInsightsClient } from "@/components/instagram/instagram-insights-client";

export const dynamic = "force-dynamic";

export default async function InstagramInsightsPage() {
  let posts: Awaited<ReturnType<typeof fetchInstagramPosts>> = [];
  let accountStats: Awaited<ReturnType<typeof fetchLatestAccountStats>> = null;
  let areas: Awaited<ReturnType<typeof fetchAreas>> = [];
  let users: Awaited<ReturnType<typeof fetchActiveUsers>> = [];

  try {
    await refreshAllInstagramPostTags();
    [posts, accountStats, areas, users] = await Promise.all([
      fetchInstagramPosts(),
      fetchLatestAccountStats(),
      fetchAreas(),
      fetchActiveUsers(),
    ]);
  } catch {
    // Supabase indisponível
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Instagram Insights</h2>
        <p className="text-muted-foreground">
          Métricas da conta e desempenho de cada postagem desde 2025. Vínculo por área e solicitante.
        </p>
      </div>
      <InstagramInsightsClient
        initialPosts={posts}
        initialAccountStats={accountStats}
        initialAreas={areas}
        initialUsers={users}
      />
    </div>
  );
}
