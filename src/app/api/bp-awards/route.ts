import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { getVoterView } from "@/lib/rh/bp-awards/server";

export const dynamic = "force-dynamic";

/** Edição corrente, quem pode ser indicado e o rascunho do colaborador logado (?previa=1: pré-visualização do RH). */
export async function GET(request: Request) {
  try {
    const preview = new URL(request.url).searchParams.get("previa") === "1";
    return NextResponse.json(await getVoterView({ preview }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
