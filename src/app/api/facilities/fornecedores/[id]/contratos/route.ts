import { facilitiesResponse } from "@/lib/facilities/api";
import { createContract } from "@/lib/facilities/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return facilitiesResponse(async () => {
    const { id } = await params;
    const body = (await request.json()) as { contract?: unknown; attach_document_ids?: unknown };
    return { supplier: await createContract(id, body.contract, body.attach_document_ids) };
  });
}
