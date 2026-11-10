import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { removeFinalist, updateFinalist } from "@/lib/rh/bp-awards/server";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** Vencedor e texto da homenagem; devolve os finalistas da edição atualizados. */
export async function PATCH(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({ finalists: await updateFinalist(id, body) });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    await removeFinalist(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
