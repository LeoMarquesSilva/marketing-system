import { facilitiesResponse } from "@/lib/facilities/api";
import { updateIssue } from "@/lib/facilities/cleaning-server";

export const dynamic = "force-dynamic";

/** Resolver o aviso, reabrir ou abrir manutenção corretiva. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return facilitiesResponse(async () => ({ month: await updateIssue(id, await request.json()) }));
}
