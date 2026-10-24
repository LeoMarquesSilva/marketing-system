import { withOpsActor, readJson } from "@/lib/ops-planner/http";
import { previewRule } from "@/lib/ops-planner/routines-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withOpsActor(async () => previewRule(await readJson(request)));
}
