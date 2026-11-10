import { facilitiesResponse } from "@/lib/facilities/api";
import { deleteMaintenanceDocument, maintenanceDocumentUrl } from "@/lib/facilities/maintenance-server";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** URL assinada do arquivo (?download=1 baixa com o nome original). */
export async function GET(request: Request, { params }: Context) {
  return facilitiesResponse(async () => {
    const { id } = await params;
    const download = new URL(request.url).searchParams.get("download") === "1";
    return { url: await maintenanceDocumentUrl(id, download) };
  });
}

export async function DELETE(_request: Request, { params }: Context) {
  return facilitiesResponse(async () => {
    const { id } = await params;
    return { plan: await deleteMaintenanceDocument(id) };
  });
}
