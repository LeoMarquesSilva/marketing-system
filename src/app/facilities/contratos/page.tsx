import { ContratosClient } from "@/components/facilities/contratos-client";
import { FacilitiesAcessoNegado } from "@/components/facilities/facilities-access-denied";
import { loadFacilitiesPageData } from "@/lib/facilities/page-data";

export const dynamic = "force-dynamic";

export default async function ContratosPage() {
  const data = await loadFacilitiesPageData();
  if (data.forbidden) return <FacilitiesAcessoNegado />;
  return <ContratosClient initialSuppliers={data.suppliers} people={data.people} />;
}
