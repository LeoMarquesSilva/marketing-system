import { facilitiesResponse } from "@/lib/facilities/api";
import { deleteService, updateService } from "@/lib/facilities/server";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  return facilitiesResponse(async () => {
    const { id } = await params;
    return { supplier: await updateService(id, await request.json()) };
  });
}

export async function DELETE(_request: Request, { params }: Context) {
  return facilitiesResponse(async () => {
    const { id } = await params;
    return { supplier: await deleteService(id) };
  });
}
