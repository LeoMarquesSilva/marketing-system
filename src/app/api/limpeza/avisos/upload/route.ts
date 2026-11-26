import { facilitiesResponse } from "@/lib/facilities/api";
import { createIssueUpload } from "@/lib/facilities/cleaning-server";

export const dynamic = "force-dynamic";

/** URL assinada para subir a foto do aviso direto no bucket privado. */
export async function POST(request: Request) {
  return facilitiesResponse(async () => createIssueUpload(await request.json()));
}
