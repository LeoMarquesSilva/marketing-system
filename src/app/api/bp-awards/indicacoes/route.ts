import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { saveNomination } from "@/lib/rh/bp-awards/server";

export const dynamic = "force-dynamic";

/** Salva a indicação de um valor (rascunho automático). */
export async function PUT(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(await saveNomination(body));
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
