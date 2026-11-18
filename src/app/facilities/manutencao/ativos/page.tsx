import { AtivosClient } from "@/components/facilities/ativos-client";
import { FacilitiesAcessoNegado } from "@/components/facilities/facilities-access-denied";
import { loadMaintenancePageData } from "@/lib/facilities/maintenance-page-data";

export const dynamic = "force-dynamic";

export default async function AtivosPage() {
  const data = await loadMaintenancePageData();
  if (!data) return <FacilitiesAcessoNegado />;
  return <AtivosClient data={data} />;
}
