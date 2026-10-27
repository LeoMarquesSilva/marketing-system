import { FacilitiesAcessoNegado } from "@/components/facilities/facilities-access-denied";
import { FornecedoresClient } from "@/components/facilities/fornecedores-client";
import { loadFacilitiesPageData } from "@/lib/facilities/page-data";

export const dynamic = "force-dynamic";

export default async function FornecedoresPage({ searchParams }: { searchParams: Promise<{ fornecedor?: string }> }) {
  const [data, params] = await Promise.all([loadFacilitiesPageData(), searchParams]);
  if (data.forbidden) return <FacilitiesAcessoNegado />;
  return <FornecedoresClient initialSuppliers={data.suppliers} people={data.people} initialSupplierId={params.fornecedor} />;
}
