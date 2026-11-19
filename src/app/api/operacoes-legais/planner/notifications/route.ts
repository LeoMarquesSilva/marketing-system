import { withOpsActor, readJson } from "@/lib/ops-planner/http";
import { listMyNotifications, markNotificationsRead } from "@/lib/ops-planner/notifications-server";

export const dynamic = "force-dynamic";

export async function GET() {
  return withOpsActor((actor) => listMyNotifications(actor));
}

/** { ids: [...] } marca esses como lidos; { all: true } marca todos. */
export async function POST(request: Request) {
  return withOpsActor(async (actor) => {
    const body = (await readJson(request)) as { ids?: unknown; all?: unknown };
    const ids = Array.isArray(body.ids) ? body.ids.filter((value): value is string => typeof value === "string") : [];
    await markNotificationsRead(actor, body.all === true ? "all" : ids);
    return { ok: true };
  });
}
