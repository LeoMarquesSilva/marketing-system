import { facilitiesResponse } from "@/lib/facilities/api";
import { createPlan } from "@/lib/facilities/maintenance-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return facilitiesResponse(async () => ({ plan: await createPlan(await request.json()) }));
}
