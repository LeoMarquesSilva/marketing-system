import { facilitiesResponse } from "@/lib/facilities/api";
import { createDocumentUpload } from "@/lib/facilities/server";

export const dynamic = "force-dynamic";

/** Devolve o token para o navegador subir o arquivo direto no bucket privado. */
export async function POST(request: Request) {
  return facilitiesResponse(async () => createDocumentUpload(await request.json()));
}
