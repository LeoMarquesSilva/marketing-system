import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { saveNote } from "@/lib/rh/feedback/server";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { body?: string };
    await saveNote(id, body.body ?? "");
    return NextResponse.json({ ok: true });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
