import { facilitiesResponse } from "@/lib/facilities/api";
import { createRecord } from "@/lib/facilities/maintenance-server";

export const dynamic = "force-dynamic";

/** Registra uma manutenção feita e avança a próxima data do plano. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return facilitiesResponse(async () => {
    const { id } = await params;
    return { plan: await createRecord(id, await request.json()) };
  });
}
