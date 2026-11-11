import { facilitiesResponse } from "@/lib/facilities/api";
import { deletePlan, updatePlan } from "@/lib/facilities/maintenance-server";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  return facilitiesResponse(async () => {
    const { id } = await params;
    return { plan: await updatePlan(id, await request.json()) };
  });
}

export async function DELETE(_request: Request, { params }: Context) {
  return facilitiesResponse(async () => {
    const { id } = await params;
    await deletePlan(id);
    return { ok: true };
  });
}
