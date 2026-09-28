import { NextResponse } from "next/server";
import {
  listContentScheduleAssignmentNotifications,
  toContentScheduleApiError,
} from "@/lib/content-schedule/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({
      notifications: await listContentScheduleAssignmentNotifications(),
    });
  } catch (error) {
    const api = toContentScheduleApiError(error);
    return NextResponse.json({ error: api.message, code: api.code }, { status: api.status });
  }
}
