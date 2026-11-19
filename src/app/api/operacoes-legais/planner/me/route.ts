import { withOpsActor } from "@/lib/ops-planner/http";
import { getPlannerContext } from "@/lib/ops-planner/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return withOpsActor((actor) => getPlannerContext(actor));
}
