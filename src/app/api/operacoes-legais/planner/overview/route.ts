import { withOpsActor } from "@/lib/ops-planner/http";
import { getOverview } from "@/lib/ops-planner/overview-server";

export const dynamic = "force-dynamic";

export async function GET() {
  return withOpsActor((actor) => getOverview(actor));
}
