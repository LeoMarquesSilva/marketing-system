import { NextResponse } from "next/server";
import { z } from "zod";
import {
  resolveContentScheduleAssignmentNotification,
  toContentScheduleApiError,
} from "@/lib/content-schedule/server";

const idSchema = z.string().uuid();

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const parsed = idSchema.safeParse((await params).id);
    if (!parsed.success) {
      return NextResponse.json({ error: "Notificação inválida." }, { status: 400 });
    }
    await resolveContentScheduleAssignmentNotification(parsed.data);
    return NextResponse.json({ success: true });
  } catch (error) {
    const api = toContentScheduleApiError(error);
    return NextResponse.json({ error: api.message, code: api.code }, { status: api.status });
  }
}
