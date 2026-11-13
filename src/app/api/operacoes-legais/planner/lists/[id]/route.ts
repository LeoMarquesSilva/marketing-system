import { withOpsActor, readJson } from "@/lib/ops-planner/http";
import { archiveList, renameList } from "@/lib/ops-planner/spaces-server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  return withOpsActor(async (actor) => ({ list: await renameList(actor, id, await readJson(request)) }));
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  return withOpsActor(async (actor) => {
    await archiveList(actor, id);
    return { ok: true };
  });
}
