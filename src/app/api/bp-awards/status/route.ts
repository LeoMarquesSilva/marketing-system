import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { getInviteStatus } from "@/lib/rh/bp-awards/server";

export const dynamic = "force-dynamic";

/** Aviso do sistema: votação aberta e indicação ainda não enviada. */
export async function GET() {
  try {
    return NextResponse.json(await getInviteStatus(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
