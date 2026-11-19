import { withOpsActor, readJson } from "@/lib/ops-planner/http";
import { deleteChecklistItem, updateChecklistItem } from "@/lib/ops-planner/tasks-server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ itemId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { itemId } = await params;
  return withOpsActor(async (actor) => ({ item: await updateChecklistItem(actor, itemId, await readJson(request)) }));
}

export async function DELETE(_request: Request, { params }: Params) {
  const { itemId } = await params;
  return withOpsActor(async (actor) => {
    await deleteChecklistItem(actor, itemId);
    return { ok: true };
  });
}
