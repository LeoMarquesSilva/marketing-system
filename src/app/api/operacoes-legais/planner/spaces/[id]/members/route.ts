import { withOpsActor, readJson } from "@/lib/ops-planner/http";
import { addMember } from "@/lib/ops-planner/spaces-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withOpsActor(async (actor) => ({ member: await addMember(actor, id, await readJson(request)) }));
}
