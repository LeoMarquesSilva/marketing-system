import {
  fetchInstagramPosts,
  fetchLatestAccountStats,
  refreshAllInstagramPostTags,
} from "@/lib/instagram-posts";
import { fetchAreas } from "@/lib/areas";
import { fetchUsers } from "@/lib/users";
import { InstagramInsightsClient } from "@/components/instagram/instagram-insights-client";

export const dynamic = "force-dynamic";

export default async function InstagramInsightsPage() {
  let posts: Awaited<ReturnType<typeof fetchInstagramPosts>> = [];
  let accountStats: Awaited<ReturnType<typeof fetchLatestAccountStats>> = null;
  let areas: Awaited<ReturnType<typeof fetchAreas>> = [];
  let users: Awaited<ReturnType<typeof fetchUsers>> = [];

  try {
    await refreshAllInstagramPostTags();
    [posts, accountStats, areas, users] = await Promise.all([
      fetchInstagramPosts(),
      fetchLatestAccountStats(),
      fetchAreas(),
      fetchUsers(),
    ]);
  } catch {
    // Supabase indisponível
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Instagram Insights</h2>
        <p className="text-muted-foreground">
          Métricas da conta e desempenho de cada postagem desde 2025. Vínculo por área(s), autores e collab.
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
