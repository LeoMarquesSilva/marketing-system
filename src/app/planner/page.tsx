import { unstable_cache } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { fetchMarketingRequests } from "@/lib/marketing-requests";
import { fetchMarketingRequestsForAuth } from "@/lib/marketing-requests-server";
import { fetchActiveUsers, fetchDesigners } from "@/lib/users";
import { getAppSettingsUncached } from "@/lib/app-settings";
import { listPlannerReels } from "@/lib/reel-deliveries/server";
import { listContentRotationAreas } from "@/lib/content-schedule/server";
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
  const [designers, users, appSettings] = await Promise.all([
    getCachedDesigners(),
    getCachedUsers(),
    getAppSettingsUncached(),
  ]);

  const showsPosts = appSettings.plannerTabs.includes("posts");
  const [requests, reels, rotationAreas] = await Promise.all([
    appSettings.kanbanVisibility === "everyone_all"
      ? createClient().then((supabaseClient) => fetchMarketingRequests({ supabaseClient }))
      : fetchMarketingRequestsForAuth(),
    // A aba Posts funciona sem reels e sem rodízio se o cronograma estiver fora do ar.
    showsPosts
      ? listPlannerReels().catch((error) => {
          console.error("[planner] reels:", error);
          return [];
        })
      : [],
    showsPosts
      ? listContentRotationAreas().catch((error) => {
          console.error("[planner] áreas do rodízio:", error);
          return [];
        })
      : [],
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Planner
        </h2>
        <p className="text-muted-foreground">
          Arraste os cards entre as colunas para atualizar o workflow
        </p>
      </div>

      <PlannerClient
        initialRequests={requests}
        reels={reels}
        rotationAreas={rotationAreas}
        designers={designers}
        users={users}
        appSettings={appSettings}
      />
    </div>
  );
}
