import { FeriasAcessoNegado } from "@/components/ferias/acesso-negado";
import { GestaoPdiClient } from "@/components/rh/pdi/gestao-pdi-client";
import { listAllPlans } from "@/lib/rh/pdi/server";
import { RhHttpError } from "@/lib/rh/qualifications/server";

export const dynamic = "force-dynamic";

type PageData = { forbidden: true } | ({ forbidden: false } & Awaited<ReturnType<typeof listAllPlans>>);

async function loadPageData(): Promise<PageData> {
  try {
    return { forbidden: false, ...(await listAllPlans()) };
  } catch (error) {
    if (error instanceof RhHttpError && error.status === 403) return { forbidden: true };
    throw error;
  }
}

export default async function GestaoPdiPage() {
  const data = await loadPageData();
  if (data.forbidden) return <FeriasAcessoNegado />;
  return <GestaoPdiClient plans={data.plans} withoutPlan={data.withoutPlan} types={data.types} managers={data.managers} />;
}
