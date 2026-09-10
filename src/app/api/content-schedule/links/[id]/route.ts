import { NextResponse } from "next/server";
import { resolvePendingScheduleLink, toContentScheduleApiError } from "@/lib/content-schedule/server";

function failure(error: unknown) {
  const api = toContentScheduleApiError(error);
  return NextResponse.json({ error: api.message, code: api.code }, { status: api.status });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (typeof body?.slot_id !== "string") return NextResponse.json({ error: "Vaga inválida." }, { status: 400 });
    await resolvePendingScheduleLink(id, body.slot_id);
    return NextResponse.json({ success: true });
  } catch (error) { return failure(error); }
}
