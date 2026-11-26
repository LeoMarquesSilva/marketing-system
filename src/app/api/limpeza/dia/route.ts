import { facilitiesResponse } from "@/lib/facilities/api";
import { getCleaningDay } from "@/lib/facilities/cleaning-server";

export const dynamic = "force-dynamic";

/** O dia da limpeza (hoje, ou ?dia=AAAA-MM-DD para Facilities). */
export async function GET(request: Request) {
  return facilitiesResponse(async () => ({ day: await getCleaningDay(new URL(request.url).searchParams.get("dia")) }));
}
