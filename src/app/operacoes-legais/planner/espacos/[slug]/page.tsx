import type { Metadata } from "next";
import { OpsAcessoNegado } from "@/components/ops-planner/ops-access-denied";
import { SpaceWorkspace } from "@/components/ops-planner/space-workspace";
import { getSpaceBySlug } from "@/lib/ops-planner/server";
import { listTasks } from "@/lib/ops-planner/tasks-server";
import { loadPlannerPage } from "@/lib/ops-planner/page-data";

export const metadata: Metadata = {
  title: "Espaço — Planner de Operações Legais — ORQESTRAI",
  description: "Lista, quadro e calendário das tarefas da equipe.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OpsPlannerSpacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await loadPlannerPage(async (actor) => {
    const space = await getSpaceBySlug(actor, slug);
    return { space, tasks: await listTasks(actor, { spaceId: space.id, includeDone: true }) };
  });
  if (data.forbidden) return <OpsAcessoNegado message={data.message} />;
  return <SpaceWorkspace key={data.space.id} context={data.context} space={data.space} initialTasks={data.tasks} />;
}
