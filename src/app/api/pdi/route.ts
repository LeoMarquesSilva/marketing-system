import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { createPlan, getPdiOverview } from "@/lib/rh/pdi/server";
import type { PdiPlanInput } from "@/lib/rh/pdi/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getPdiOverview());
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PdiPlanInput;
    return NextResponse.json(await createPlan(body));
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
