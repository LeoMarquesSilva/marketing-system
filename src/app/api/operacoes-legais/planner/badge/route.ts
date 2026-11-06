import { withOpsActor } from "@/lib/ops-planner/http";
import { countMyDueTasks } from "@/lib/ops-planner/notifications-server";

export const dynamic = "force-dynamic";

/** Contador do menu: tarefas minhas atrasadas ou que vencem hoje. */
export async function GET() {
  return withOpsActor(async (actor) => ({ due: await countMyDueTasks(actor) }));
}
