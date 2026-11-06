import type { Metadata } from "next";
import { OpsAcessoNegado } from "@/components/ops-planner/ops-access-denied";
import { RoutinesClient } from "@/components/ops-planner/routines-client";
import { listRoutines } from "@/lib/ops-planner/routines-server";
import { loadPlannerPage } from "@/lib/ops-planner/page-data";

export const metadata: Metadata = {
  title: "Rotinas — Planner de Operações Legais — ORQESTRAI",
  description: "Rotinas recorrentes das equipes, com alarme de vencimento.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OpsPlannerRoutinesPage() {
  const data = await loadPlannerPage(async (actor, context) => ({
    routines: await listRoutines(
      actor,
      context.spaces.map((space) => space.id)
    ),
  }));
  if (data.forbidden) return <OpsAcessoNegado message={data.message} />;
  return <RoutinesClient context={data.context} initialRoutines={data.routines} />;
}
