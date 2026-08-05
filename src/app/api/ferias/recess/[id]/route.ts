import { NextResponse } from "next/server";
import { deleteRecess, toApiError } from "@/lib/ferias/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await deleteRecess(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const apiError = toApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
