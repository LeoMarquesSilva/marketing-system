import { fetchMarketingRequestsForAuth } from "@/lib/marketing-requests-server";
import { fetchUsers } from "@/lib/users";
import { MOCK_REQUESTS } from "@/lib/mock-data";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export const dynamic = "force-dynamic";

const ASSIGNEE_NAME = "Valentina Iacovacci";

export default async function DashboardPage() {
  let displayRequests = MOCK_REQUESTS;
  let assigneeAvatarUrl: string | undefined;

  try {
    const [requests, users] = await Promise.all([
      fetchMarketingRequestsForAuth(),
      fetchUsers(),
    ]);
    displayRequests = requests.length === 0 ? MOCK_REQUESTS : requests;
    const assigneeUser = users.find(
      (u) => u.name.toLowerCase() === ASSIGNEE_NAME.toLowerCase()
    );
    assigneeAvatarUrl = assigneeUser?.avatar_url ?? undefined;
  } catch {
    // Env vars ausentes ou Supabase indisponível: usa mock
  }

  return (
    <DashboardClient
      requests={displayRequests}
      assigneeAvatarUrl={assigneeAvatarUrl}
    />
  );
}
