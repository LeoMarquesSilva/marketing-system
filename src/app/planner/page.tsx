import { unstable_cache } from "next/cache";
import { fetchMarketingRequestsForAuth } from "@/lib/marketing-requests-server";
import { fetchActiveUsers, fetchDesigners } from "@/lib/users";
import { PlannerClient } from "./planner-client";

export const dynamic = "force-dynamic";

// Cache de 30s para designers e users (dados que mudam pouco)
const getCachedDesigners = unstable_cache(
  fetchDesigners,
  ["planner-designers"],
  { revalidate: 30 }
);
const getCachedUsers = unstable_cache(
  fetchActiveUsers,
  ["planner-users"],
  { revalidate: 30 }
);

export default async function PlannerPage() {
  const [requests, designers, users] = await Promise.all([
    fetchMarketingRequestsForAuth(),
    getCachedDesigners(),
    getCachedUsers(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Planner
        </h2>
        <p className="text-muted-foreground">
          Arraste os cards entre as colunas para atualizar o workflow
        </p>
      </div>

      <PlannerClient
        initialRequests={requests}
        designers={designers}
        users={users}
      />
    </div>
  );
}
