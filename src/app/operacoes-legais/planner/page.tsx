import type { Metadata } from "next";
import { MyTasksClient } from "@/components/ops-planner/my-tasks-client";
import { OpsAcessoNegado } from "@/components/ops-planner/ops-access-denied";
import { listMarketingItems } from "@/lib/ops-planner/marketing-bridge";
import { getMyPrefs } from "@/lib/ops-planner/notifications-server";
import { listTasks } from "@/lib/ops-planner/tasks-server";
import { loadPlannerPage } from "@/lib/ops-planner/page-data";

export const metadata: Metadata = {
  title: "Minhas tarefas — Planner de Operações Legais — ORQESTRAI",
  description: "Tudo o que está com você nos espaços de Operações Legais.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OpsPlannerMyTasksPage() {
  const data = await loadPlannerPage(async (actor) => {
    const [tasks, marketing, prefs] = await Promise.all([
      listTasks(actor, { mine: true }),
      listMarketingItems([actor.userId]),
      getMyPrefs(actor),
    ]);
    return { tasks, marketing, prefs };
  });
  if (data.forbidden) return <OpsAcessoNegado message={data.message} />;
  return <MyTasksClient context={data.context} initialTasks={data.tasks} initialMarketing={data.marketing} prefs={data.prefs} />;
}
