import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { deleteMeeting, updateMeeting } from "@/lib/rh/one-on-one/server";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    return NextResponse.json(await updateMeeting(id, (await request.json()) as Parameters<typeof updateMeeting>[1]));
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    await deleteMeeting(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
