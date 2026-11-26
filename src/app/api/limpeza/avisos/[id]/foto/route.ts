import { facilitiesResponse } from "@/lib/facilities/api";
import { issuePhotoUrl } from "@/lib/facilities/cleaning-server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return facilitiesResponse(async () => ({ url: await issuePhotoUrl(id) }));
}
