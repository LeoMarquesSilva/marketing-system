import "server-only";

import { NextResponse } from "next/server";
import { toFacilitiesApiError } from "./server";

/** Resposta JSON das rotas /api/facilities, com o erro tratado no mesmo formato. */
export async function facilitiesResponse(run: () => Promise<object>): Promise<NextResponse> {
  try {
    return NextResponse.json(await run());
  } catch (error) {
    const apiError = toFacilitiesApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
