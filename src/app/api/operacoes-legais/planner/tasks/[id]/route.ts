import { withOpsActor, readJson } from "@/lib/ops-planner/http";
import { archiveTask, getTaskDetail, updateTask } from "@/lib/ops-planner/tasks-server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  return withOpsActor((actor) => getTaskDetail(actor, id));
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  return withOpsActor(async (actor) => ({ task: await updateTask(actor, id, await readJson(request)) }));
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  return withOpsActor(async (actor) => {
    await archiveTask(actor, id);
    return { ok: true };
  });
}
