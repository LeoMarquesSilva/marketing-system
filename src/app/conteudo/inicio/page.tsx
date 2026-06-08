import { getAuthenticatedContentUser } from "@/lib/content-access";
import { fetchInstagramPosts } from "@/lib/instagram-posts";
import { getPostSolicitantes } from "@/lib/instagram-link-rules";
import { computeEngagementActionsFromPost } from "@/lib/instagram-engagement";
import { MeuInstagramClient, type OfficeStats } from "@/components/conteudo/meu-instagram-client";
import { sanitizeInstagramPostsForClient } from "@/lib/instagram-thumbnail-client";

export const dynamic = "force-dynamic";

export default async function ConteudoInicioPage() {
  const auth = await getAuthenticatedContentUser();
  const userId = auth?.profile?.id ?? null;
  const userName = auth?.profile?.name ?? "";

  let myPosts: Awaited<ReturnType<typeof fetchInstagramPosts>> = [];
  let office: OfficeStats = { posts: 0, avgReach: 0, avgActions: 0, rate: 0 };

  if (userId) {
    try {
      const all = await fetchInstagramPosts();
      myPosts = all.filter((p) => getPostSolicitantes(p).some((s) => s.id === userId));

      const n = all.length;
      const totalReach = all.reduce((s, p) => s + (p.reach ?? 0), 0);
      const totalActions = all.reduce((s, p) => s + computeEngagementActionsFromPost(p), 0);
      office = {
        posts: n,
        avgReach: n > 0 ? Math.round(totalReach / n) : 0,
        avgActions: n > 0 ? Math.round(totalActions / n) : 0,
        rate: totalReach > 0 ? (totalActions / totalReach) * 100 : 0,
      };
    } catch {
      myPosts = [];
    }
  }

  return (
    <MeuInstagramClient
      userName={userName}
      posts={sanitizeInstagramPostsForClient(myPosts)}
      office={office}
    />
  );
}
