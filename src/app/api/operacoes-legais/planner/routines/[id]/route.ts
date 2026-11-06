import { withOpsActor, readJson } from "@/lib/ops-planner/http";
import { archiveRoutine, updateRoutine } from "@/lib/ops-planner/routines-server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  return withOpsActor(async (actor) => ({ routine: await updateRoutine(actor, id, await readJson(request)) }));
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  return withOpsActor(async (actor) => {
    await archiveRoutine(actor, id);
    return { ok: true };
  });
}
