import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { submitBallot } from "@/lib/rh/bp-awards/server";

export const dynamic = "force-dynamic";

/** Envia as 5 indicações para o comitê. */
export async function POST() {
  try {
    return NextResponse.json(await submitBallot());
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
