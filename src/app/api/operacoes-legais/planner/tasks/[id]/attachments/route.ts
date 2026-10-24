import { withOpsActor, readJson } from "@/lib/ops-planner/http";
import { addAttachment } from "@/lib/ops-planner/tasks-server";

export const dynamic = "force-dynamic";

/** Registra um link ou um arquivo já enviado pela URL assinada de ./upload. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withOpsActor(async (actor) => ({ attachment: await addAttachment(actor, id, await readJson(request)) }));
}
