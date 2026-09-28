import { NextResponse } from "next/server";
import {
  linkContentScheduleViosSchema,
  linkContentScheduleViosTask,
  toContentScheduleApiError,
} from "@/lib/content-schedule/server";

function failure(error: unknown) {
  const api = toContentScheduleApiError(error);
  return NextResponse.json({ error: api.message, code: api.code }, { status: api.status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = linkContentScheduleViosSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Revise o vínculo VIOS." }, { status: 400 });
    }
    await linkContentScheduleViosTask(id, parsed.data);
    return NextResponse.json({ success: true });
  } catch (error) {
    return failure(error);
  }
}
