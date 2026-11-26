import { facilitiesResponse } from "@/lib/facilities/api";
import { getCleaningSchedule, updateCleaningSchedule } from "@/lib/facilities/cleaning-server";

export const dynamic = "force-dynamic";

export async function GET() {
  return facilitiesResponse(async () => ({ schedule: await getCleaningSchedule() }));
}

/** Muda uma célula da grade ou os ambientes (novo, renomear, ativar, mover). */
export async function POST(request: Request) {
  return facilitiesResponse(async () => ({ schedule: await updateCleaningSchedule(await request.json()) }));
}
