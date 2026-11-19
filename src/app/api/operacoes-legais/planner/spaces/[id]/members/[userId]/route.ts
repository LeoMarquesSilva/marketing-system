import { withOpsActor, readJson } from "@/lib/ops-planner/http";
import { removeMember, updateMemberRole } from "@/lib/ops-planner/spaces-server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; userId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id, userId } = await params;
  return withOpsActor(async (actor) => ({ member: await updateMemberRole(actor, id, userId, await readJson(request)) }));
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id, userId } = await params;
  return withOpsActor(async (actor) => {
    await removeMember(actor, id, userId);
    return { ok: true };
  });
}
