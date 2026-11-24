import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { getHrOverview } from "@/lib/rh/feedback/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    void request;
    return NextResponse.json(await getHrOverview());
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
