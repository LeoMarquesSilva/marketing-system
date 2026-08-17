import { NextResponse } from "next/server";
import {
  listQualificationsForHr,
  toRhApiError,
} from "@/lib/rh/qualifications/server";

export async function GET() {
  try {
    const items = await listQualificationsForHr();
    return NextResponse.json({ items });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
