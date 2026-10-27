import { facilitiesResponse } from "@/lib/facilities/api";
import { deleteContract, updateContract } from "@/lib/facilities/server";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  return facilitiesResponse(async () => {
    const { id } = await params;
    const body = (await request.json()) as { contract?: unknown; attach_document_ids?: unknown };
    return { supplier: await updateContract(id, body.contract, body.attach_document_ids) };
  });
}

export async function DELETE(_request: Request, { params }: Context) {
  return facilitiesResponse(async () => {
    const { id } = await params;
    return { supplier: await deleteContract(id) };
  });
}
