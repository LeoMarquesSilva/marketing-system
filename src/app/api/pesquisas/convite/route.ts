import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { pendingSurveysForViewer } from "@/lib/pesquisas/server";

export const dynamic = "force-dynamic";

/** Pesquisas abertas esperando a resposta de quem está logado. */
export async function GET() {
  try {
    return NextResponse.json({ surveys: await pendingSurveysForViewer() });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
