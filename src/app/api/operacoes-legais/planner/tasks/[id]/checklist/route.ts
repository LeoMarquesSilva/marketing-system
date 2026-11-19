import { withOpsActor, readJson } from "@/lib/ops-planner/http";
import { addChecklistItem } from "@/lib/ops-planner/tasks-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withOpsActor(async (actor) => ({ item: await addChecklistItem(actor, id, await readJson(request)) }));
}
