import { facilitiesResponse } from "@/lib/facilities/api";
import { closeDay, undoCloseDay } from "@/lib/facilities/cleaning-server";

export const dynamic = "force-dynamic";

/** Encerra o dia (a equipe confirma o que fez). */
export async function POST(request: Request) {
  return facilitiesResponse(async () => ({ day: await closeDay(await request.json()) }));
}

/** Desfaz o encerramento, enquanto Facilities não assinou. */
export async function DELETE(request: Request) {
  return facilitiesResponse(async () => ({ day: await undoCloseDay(await request.json()) }));
}
