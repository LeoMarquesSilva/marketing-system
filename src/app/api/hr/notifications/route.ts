import { NextResponse } from "next/server";
import { listPendingHrNotifications, toRhApiError } from "@/lib/hr/notifications/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ notifications: await listPendingHrNotifications() });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
