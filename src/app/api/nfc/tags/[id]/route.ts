import { NextResponse } from "next/server";
import { deleteNfcTag, getNfcTag, toApiError, updateNfcTag } from "@/lib/nfc/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    return NextResponse.json(await getNfcTag(id));
  } catch (error) {
    const apiError = toApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const [{ id }, input] = await Promise.all([context.params, request.json()]);
    return NextResponse.json({ tag: await updateNfcTag(id, input) });
  } catch (error) {
    const apiError = toApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await deleteNfcTag(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const apiError = toApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

