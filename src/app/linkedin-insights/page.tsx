import { Linkedin } from "lucide-react";
import { LinkedinInsightsClient } from "@/components/linkedin/linkedin-insights-client";
import { fetchLinkedinDashboardData } from "@/lib/linkedin-server";
import type { LinkedinDashboardData } from "@/lib/linkedin-types";

export const dynamic = "force-dynamic";

const EMPTY_DATA: LinkedinDashboardData = {
  dailyMetrics: [],
  followerDailyMetrics: [],
  visitorDailyMetrics: [],
  demographics: [],
  posts: [],
  imports: [],
  instagramCandidates: [],
  unavailableReason: null,
};

export default async function LinkedinInsightsPage() {
  let data = EMPTY_DATA;
  try {
    data = await fetchLinkedinDashboardData();
  } catch (error) {
    data = {
      ...EMPTY_DATA,
      unavailableReason: error instanceof Error ? error.message : "LinkedIn Insights indisponível.",
    };
  }

  return (
    <div className="flex min-h-0 w-full flex-col gap-5">
      <header className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0A66C2] text-white shadow-[0_10px_24px_rgba(10,102,194,0.2)]">
          <Linkedin className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">LinkedIn Insights</h2>
          <p className="text-sm text-muted-foreground">Desempenho editorial, rankings e associação automática com o Instagram.</p>
        </div>
      </header>
      <LinkedinInsightsClient initialData={data} />
    </div>
  );
}
