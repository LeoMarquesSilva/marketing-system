import { fetchMarketingRequestsForAuth } from "@/lib/marketing-requests-server";
import { fetchUsers } from "@/lib/users";
import { MOCK_REQUESTS } from "@/lib/mock-data";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export const dynamic = "force-dynamic";

const ASSIGNEE_NAME = "Valentina Iacovacci";

export default async function DashboardPage() {
  const [requests, users] = await Promise.all([
    fetchMarketingRequestsForAuth(),
    fetchUsers(),
  ]);

  const displayRequests = requests.length === 0 ? MOCK_REQUESTS : requests;
  const assigneeUser = users.find(
    (u) => u.name.toLowerCase() === ASSIGNEE_NAME.toLowerCase()
  );
  const assigneeAvatarUrl = assigneeUser?.avatar_url ?? undefined;

  return (
    <DashboardClient
      requests={displayRequests}
      assigneeAvatarUrl={assigneeAvatarUrl}
    />
  );
}
