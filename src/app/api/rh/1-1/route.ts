import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { getHrOverview } from "@/lib/rh/one-on-one/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getHrOverview());
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
