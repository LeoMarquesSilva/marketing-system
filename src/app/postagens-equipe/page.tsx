import { TeamPostsClient } from "@/components/team-posts/team-posts-client";
import { loadTeamPostsPageData } from "@/lib/team-posts/server";

export const dynamic = "force-dynamic";

export default async function TeamPostsPage() {
  const data = await loadTeamPostsPageData();
  return <TeamPostsClient data={data} />;
}
