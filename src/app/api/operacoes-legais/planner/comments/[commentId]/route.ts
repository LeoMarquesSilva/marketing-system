import { withOpsActor } from "@/lib/ops-planner/http";
import { deleteComment } from "@/lib/ops-planner/tasks-server";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ commentId: string }> }) {
  const { commentId } = await params;
  return withOpsActor(async (actor) => {
    await deleteComment(actor, commentId);
    return { ok: true };
  });
}
