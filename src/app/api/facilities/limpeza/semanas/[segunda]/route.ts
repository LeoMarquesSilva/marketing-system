import { facilitiesResponse } from "@/lib/facilities/api";
import { saveWeekNote } from "@/lib/facilities/cleaning-server";

export const dynamic = "force-dynamic";

/** Anotação da semana. */
export async function PUT(request: Request, { params }: { params: Promise<{ segunda: string }> }) {
  const { segunda } = await params;
  return facilitiesResponse(async () => ({ month: await saveWeekNote(segunda, await request.json()) }));
}
