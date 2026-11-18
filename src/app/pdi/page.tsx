import { MeuPdiClient } from "@/components/rh/pdi/meu-pdi-client";
import { getPdiOverview, getPlanDetail } from "@/lib/rh/pdi/server";
import { RhHttpError } from "@/lib/rh/qualifications/server";
import type { PdiOverview, PdiPlanDetail } from "@/lib/rh/pdi/types";

export const dynamic = "force-dynamic";

type PageData = { forbidden: string } | { forbidden: null; overview: PdiOverview; selected: PdiPlanDetail | null };

async function loadPageData(requestedId: string | undefined): Promise<PageData> {
  try {
    const overview = await getPdiOverview();
    // Plano em destaque: o pedido na URL (se for meu) ou o ativo mais recente.
    const mine = overview.myPlans;
    const requested = requestedId ? mine.find((plan) => plan.id === requestedId) : undefined;
    const active = mine.filter((plan) => plan.status === "ativo").sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
    const target = requested ?? active ?? null;
    return { forbidden: null, overview, selected: target ? await getPlanDetail(target.id) : null };
  } catch (error) {
    if (error instanceof RhHttpError && error.status === 403) return { forbidden: error.message };
    throw error;
  }
}

export default async function MeuPdiPage({
  searchParams,
}: {
  searchParams: Promise<{ plano?: string; aba?: string }>;
}) {
  const params = await searchParams;
  const data = await loadPageData(params.plano);
  if (data.forbidden !== null) {
    return (
      <div className="rounded-lg border border-[#dce9eb] bg-white px-6 py-10 text-center text-sm text-muted-foreground">
        {data.forbidden}
      </div>
    );
  }
  const initialTab = params.aba === "equipe" || (!data.selected && data.overview.isLeader) ? "equipe" : "meu";
  return <MeuPdiClient overview={data.overview} selected={data.selected} initialTab={initialTab} />;
}
