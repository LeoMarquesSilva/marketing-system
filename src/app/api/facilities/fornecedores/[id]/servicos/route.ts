import { facilitiesResponse } from "@/lib/facilities/api";
import { createService } from "@/lib/facilities/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return facilitiesResponse(async () => {
    const { id } = await params;
    return { supplier: await createService(id, await request.json()) };
  });
}
