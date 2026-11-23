import { Suspense } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { redirect } from "next/navigation";
import { MetricsSummaryClient } from "@/components/social-metrics/metrics-summary-client";
import { currentMetricsAccess } from "@/lib/social-metrics/access";
import { fetchMetricsSummaryData } from "@/lib/social-metrics/server";

export const dynamic = "force-dynamic";

/** Resumo de Métricas: Instagram + LinkedIn + Site lado a lado, só dos canais liberados. */
export default async function MetricasResumoPage() {
  const access = await currentMetricsAccess();
  if (!access) redirect("/login?next=%2Fmetricas");

  let data: Awaited<ReturnType<typeof fetchMetricsSummaryData>> | null = null;
  let error: string | null = null;
  try {
    data = await fetchMetricsSummaryData(access.channels);
  } catch (err) {
    error = err instanceof Error ? err.message : "Não foi possível carregar o resumo.";
  }

  if (!data) {
    return <div className="rounded-lg border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-900">Não foi possível carregar o resumo: {error}</div>;
  }

  return (
    <TooltipProvider>
      <Suspense>
        <MetricsSummaryClient data={data} canWriteReading={access.canWriteReading} />
      </Suspense>
    </TooltipProvider>
  );
}
