import { facilitiesResponse } from "@/lib/facilities/api";
import { createDocument } from "@/lib/facilities/server";

export const dynamic = "force-dynamic";

/** Registra o arquivo já enviado (storage_path) ou um link do SharePoint (external_url). */
export async function POST(request: Request) {
  return facilitiesResponse(async () => createDocument(await request.json()));
}
