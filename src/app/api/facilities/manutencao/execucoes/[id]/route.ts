import { facilitiesResponse } from "@/lib/facilities/api";
import { deleteRecord } from "@/lib/facilities/maintenance-server";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return facilitiesResponse(async () => {
    const { id } = await params;
    return { plan: await deleteRecord(id) };
  });
}
