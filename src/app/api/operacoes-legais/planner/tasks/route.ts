import { withOpsActor, readJson } from "@/lib/ops-planner/http";
import { listMarketingItems } from "@/lib/ops-planner/marketing-bridge";
import { createTask, listTasks } from "@/lib/ops-planner/tasks-server";

export const dynamic = "force-dynamic";

/** ?space=<id> (quadro do espaço) ou ?mine=1 (Minhas tarefas, com as solicitações de Marketing). */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const mine = params.get("mine") === "1";
  return withOpsActor(async (actor) => {
    const tasks = await listTasks(actor, {
      spaceId: params.get("space") ?? undefined,
      mine,
      includeDone: params.get("done") === "1",
    });
    return { tasks, marketing: mine ? await listMarketingItems([actor.userId]) : [] };
  });
}

export async function POST(request: Request) {
  return withOpsActor(async (actor) => ({ task: await createTask(actor, await readJson(request)) }));
}
