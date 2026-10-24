import { withOpsActor, readJson } from "@/lib/ops-planner/http";
import { createRoutine, listRoutines } from "@/lib/ops-planner/routines-server";
import { listVisibleSpaces } from "@/lib/ops-planner/server";

export const dynamic = "force-dynamic";

/** ?space=<id> filtra um espaço; sem ele, todas as rotinas que a pessoa enxerga. */
export async function GET(request: Request) {
  const space = new URL(request.url).searchParams.get("space");
  return withOpsActor(async (actor) => {
    const spaceIds = space ? [space] : (await listVisibleSpaces(actor)).map((item) => item.id);
    return { routines: await listRoutines(actor, spaceIds) };
  });
}

export async function POST(request: Request) {
  return withOpsActor(async (actor) => ({ routine: await createRoutine(actor, await readJson(request)) }));
}
