import type { Metadata } from "next";
import { OpsAcessoNegado } from "@/components/ops-planner/ops-access-denied";
import { SpacesIndex } from "@/components/ops-planner/spaces-index";
import { listSpaceCounters } from "@/lib/ops-planner/tasks-server";
import { loadPlannerPage } from "@/lib/ops-planner/page-data";

export const metadata: Metadata = {
  title: "Espaços — Planner de Operações Legais — ORQESTRAI",
  description: "Os espaços de trabalho das equipes de Operações Legais.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OpsPlannerSpacesPage() {
  const data = await loadPlannerPage(async (_actor, context) => ({
    counters: await listSpaceCounters(
      context.spaces.map((space) => space.id),
      context.today
    ),
  }));
  if (data.forbidden) return <OpsAcessoNegado message={data.message} />;
  return <SpacesIndex context={data.context} counters={data.counters} />;
}
