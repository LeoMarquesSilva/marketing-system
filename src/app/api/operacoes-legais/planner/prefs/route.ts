import { withOpsActor, readJson } from "@/lib/ops-planner/http";
import { getMyPrefs, updateMyPrefs } from "@/lib/ops-planner/notifications-server";

export const dynamic = "force-dynamic";

export async function GET() {
  return withOpsActor(async (actor) => ({ prefs: await getMyPrefs(actor) }));
}

export async function PATCH(request: Request) {
  return withOpsActor(async (actor) => ({ prefs: await updateMyPrefs(actor, await readJson(request)) }));
}
