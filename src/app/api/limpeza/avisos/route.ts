import { facilitiesResponse } from "@/lib/facilities/api";
import { createIssue } from "@/lib/facilities/cleaning-server";

export const dynamic = "force-dynamic";

/** Avisar um problema (texto e foto) para Facilities. */
export async function POST(request: Request) {
  return facilitiesResponse(async () => ({ day: await createIssue(await request.json()) }));
}
