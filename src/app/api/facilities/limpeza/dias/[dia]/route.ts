import { facilitiesResponse } from "@/lib/facilities/api";
import { updateCleaningDay } from "@/lib/facilities/cleaning-server";

export const dynamic = "force-dynamic";

/** Conferir e assinar, reabrir ou marcar o dia como sem limpeza. */
export async function POST(request: Request, { params }: { params: Promise<{ dia: string }> }) {
  const { dia } = await params;
  return facilitiesResponse(async () => ({ month: await updateCleaningDay(dia, await request.json()) }));
}
