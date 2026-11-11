import { facilitiesResponse } from "@/lib/facilities/api";
import { createMaintenanceUpload } from "@/lib/facilities/maintenance-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return facilitiesResponse(async () => createMaintenanceUpload(await request.json()));
}
