import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { getOverview, scheduleMeeting } from "@/lib/rh/one-on-one/server";
import type { ScheduleInput } from "@/lib/rh/one-on-one/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getOverview());
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

export async function POST(request: Request) {
  try {
    return NextResponse.json(await scheduleMeeting((await request.json()) as ScheduleInput));
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
