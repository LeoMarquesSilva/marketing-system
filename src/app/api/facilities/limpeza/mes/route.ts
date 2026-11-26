import { facilitiesResponse } from "@/lib/facilities/api";
import { getCleaningMonth } from "@/lib/facilities/cleaning-server";

export const dynamic = "force-dynamic";

/** Acompanhamento do mês (?mes=AAAA-MM). */
export async function GET(request: Request) {
  return facilitiesResponse(async () => ({ month: await getCleaningMonth(new URL(request.url).searchParams.get("mes")) }));
}
