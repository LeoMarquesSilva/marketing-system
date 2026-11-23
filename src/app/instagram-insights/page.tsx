import { Suspense } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InstagramMetricsClient } from "@/components/instagram/metrics/instagram-metrics-client";
import { fetchInstagramMetricsData } from "@/lib/social-metrics/server";

export const dynamic = "force-dynamic";

/**
 * Métricas do Instagram. Só lê o banco: a coleta na Meta é do cron (todo dia
 * às 6h, stories a cada 4 h) ou do botão "Atualizar agora".
 */
export default async function InstagramInsightsPage() {
  let data: Awaited<ReturnType<typeof fetchInstagramMetricsData>> | null = null;
  let error: string | null = null;
  try {
    data = await fetchInstagramMetricsData();
  } catch (err) {
    error = err instanceof Error ? err.message : "Não foi possível carregar o Instagram.";
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-900">
        Não foi possível carregar as métricas do Instagram: {error}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Suspense>
        <InstagramMetricsClient data={data} />
      </Suspense>
    </TooltipProvider>
  );
}
