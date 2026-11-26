import { facilitiesResponse } from "@/lib/facilities/api";
import { markCleaningGuideSeen } from "@/lib/facilities/cleaning-server";

export const dynamic = "force-dynamic";

/** Marca o guia de uma tela da Limpeza como visto: { guide }. */
export async function POST(request: Request) {
  return facilitiesResponse(async () => markCleaningGuideSeen(await request.json().catch(() => null)));
}
