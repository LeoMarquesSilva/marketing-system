import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { getAvailability } from "@/lib/rh/one-on-one/server";
import type { AvailabilityInput } from "@/lib/rh/one-on-one/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    return NextResponse.json(await getAvailability((await request.json()) as AvailabilityInput));
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
