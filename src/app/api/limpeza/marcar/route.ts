import { facilitiesResponse } from "@/lib/facilities/api";
import { markArea, unmarkArea } from "@/lib/facilities/cleaning-server";

export const dynamic = "force-dynamic";

/** Marca o ambiente como limpo (ou não limpo, com o motivo). */
export async function POST(request: Request) {
  return facilitiesResponse(async () => ({ day: await markArea(await request.json()) }));
}

/** Desfaz a marcação do ambiente no dia. */
export async function DELETE(request: Request) {
  return facilitiesResponse(async () => ({ day: await unmarkArea(await request.json()) }));
}
