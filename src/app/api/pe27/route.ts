import { NextResponse } from "next/server";
import { loadPe27Board, toPe27ApiError } from "@/lib/pe27/server";

export const dynamic = "force-dynamic";

/** Quadro do PE27: grupos do workshop, alavancas, metas e decisões. */
export async function GET() {
  try {
    return NextResponse.json(await loadPe27Board());
  } catch (error) {
    const apiError = toPe27ApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
