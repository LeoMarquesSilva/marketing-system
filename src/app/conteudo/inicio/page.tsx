import { getAuthenticatedContentUser } from "@/lib/content-access";
import { fetchInstagramPosts } from "@/lib/instagram-posts";
import { getPostSolicitantes } from "@/lib/instagram-link-rules";
import { MeuInstagramClient } from "@/components/conteudo/meu-instagram-client";

export const dynamic = "force-dynamic";

export default async function ConteudoInicioPage() {
  const auth = await getAuthenticatedContentUser();
  const userId = auth?.profile?.id ?? null;
  const userName = auth?.profile?.name ?? "";

  let myPosts: Awaited<ReturnType<typeof fetchInstagramPosts>> = [];
  if (userId) {
    try {
      const all = await fetchInstagramPosts();
      myPosts = all.filter((p) => getPostSolicitantes(p).some((s) => s.id === userId));
    } catch {
      myPosts = [];
    }
  }

  return <MeuInstagramClient userName={userName} posts={myPosts} />;
}
