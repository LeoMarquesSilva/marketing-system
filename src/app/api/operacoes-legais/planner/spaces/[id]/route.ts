import { withOpsActor, readJson } from "@/lib/ops-planner/http";
import { updateSpace } from "@/lib/ops-planner/spaces-server";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withOpsActor(async (actor) => ({ space: await updateSpace(actor, id, await readJson(request)) }));
}
