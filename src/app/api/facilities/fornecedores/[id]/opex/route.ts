import { facilitiesResponse } from "@/lib/facilities/api";
import { setOpexNames } from "@/lib/facilities/server";

export const dynamic = "force-dynamic";

/** Troca os nomes do OPEX ligados ao fornecedor. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return facilitiesResponse(async () => {
    const { id } = await params;
    const body = (await request.json()) as { names?: unknown };
    return { supplier: await setOpexNames(id, body.names) };
  });
}
