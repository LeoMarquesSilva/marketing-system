import { FacilitiesAcessoNegado } from "@/components/facilities/facilities-access-denied";
import { ManutencaoClient } from "@/components/facilities/manutencao-client";
import { loadMaintenancePageData } from "@/lib/facilities/maintenance-page-data";

export const dynamic = "force-dynamic";

export default async function ManutencaoPage({ searchParams }: { searchParams: Promise<{ plano?: string; novo?: string }> }) {
  const [data, params] = await Promise.all([loadMaintenancePageData(), searchParams]);
  if (!data) return <FacilitiesAcessoNegado />;
  return <ManutencaoClient data={data} initialPlanId={params.plano} newForAssetId={params.novo} />;
}
