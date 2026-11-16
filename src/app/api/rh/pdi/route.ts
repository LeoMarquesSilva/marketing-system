import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { listAllPlans } from "@/lib/rh/pdi/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await listAllPlans());
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
