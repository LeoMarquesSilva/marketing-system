import type { Metadata } from "next";
import { ManagementClient } from "@/components/ops-planner/management-client";
import { OpsAcessoNegado } from "@/components/ops-planner/ops-access-denied";
import { getOverview } from "@/lib/ops-planner/overview-server";
import { loadPlannerPage } from "@/lib/ops-planner/page-data";

export const metadata: Metadata = {
  title: "Gestão — Planner de Operações Legais — ORQESTRAI",
  description: "Indicadores dos espaços para líderes e gestores.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OpsPlannerManagementPage() {
  const data = await loadPlannerPage(async (actor) => ({ overview: await getOverview(actor) }));
  if (data.forbidden) return <OpsAcessoNegado message={data.message} />;
  return <ManagementClient overview={data.overview} context={data.context} />;
}
