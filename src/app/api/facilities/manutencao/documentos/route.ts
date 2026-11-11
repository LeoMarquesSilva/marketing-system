import { facilitiesResponse } from "@/lib/facilities/api";
import { createMaintenanceDocument } from "@/lib/facilities/maintenance-server";

export const dynamic = "force-dynamic";

/** Registra laudo, NF, OS ou PMOC já enviado (storage_path) ou um link. */
export async function POST(request: Request) {
  return facilitiesResponse(async () => ({ plan: await createMaintenanceDocument(await request.json()) }));
}
