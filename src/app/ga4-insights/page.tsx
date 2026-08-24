import { Globe } from "lucide-react";
import { Ga4InsightsClient } from "@/components/ga4/ga4-insights-client";
import { fetchGa4DashboardData } from "@/lib/ga4-server";
import type { Ga4DashboardData } from "@/lib/ga4-server";

export const dynamic = "force-dynamic";

const EMPTY_DATA: Ga4DashboardData = {
  dailyMetrics: [],
  channelMetrics: [],
  pageMetrics: [],
  locationMetrics: [],
  deviceMetrics: [],
  landingPageMetrics: [],
  keyEventMetrics: [],
  lastImport: null,
  unavailableReason: null,
};

export default async function Ga4InsightsPage() {
  let data = EMPTY_DATA;
  try {
    data = await fetchGa4DashboardData();
  } catch (error) {
    data = {
      ...EMPTY_DATA,
      unavailableReason: error instanceof Error ? error.message : "GA4 Insights indisponível.",
    };
  }

  return (
    <div className="flex min-h-0 w-full flex-col gap-5">
      <header className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#47cdd0] text-white shadow-[0_10px_24px_rgba(71,205,208,0.3)]">
          <Globe className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Analytics (GA4)</h2>
          <p className="text-sm text-muted-foreground">Tráfego do site institucional: sessões, usuários, canais e páginas mais visitadas.</p>
        </div>
      </header>
      <Ga4InsightsClient initialData={data} />
    </div>
  );
}
