import { FeriasAcessoNegado } from "@/components/ferias/acesso-negado";
import { OrganogramaClient } from "@/components/rh/organograma/organograma-client";
import { RhHttpError } from "@/lib/rh/qualifications/server";
import { loadOrgChartData } from "@/lib/rh/org-chart-server";
import type { OrgChartData } from "@/lib/rh/org-chart";

export const dynamic = "force-dynamic";

async function loadPageData(): Promise<OrgChartData | null> {
  try {
    return await loadOrgChartData();
  } catch (error) {
    if (error instanceof RhHttpError && error.status === 403) return null;
    throw error;
  }
}

export default async function OrganogramaPage({
  searchParams,
}: {
  searchParams: Promise<{ visao?: string; equipe?: string; area?: string; ajustar?: string }>;
}) {
  const [data, params] = await Promise.all([loadPageData(), searchParams]);
  if (!data) return <FeriasAcessoNegado />;
  return (
    <OrganogramaClient
      initialData={data}
      initialMode={params.visao}
      initialTeam={params.equipe}
      initialDivision={params.area}
      initialEditing={params.ajustar === "1"}
    />
  );
}
