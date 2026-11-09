import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { getVoterView } from "@/lib/rh/bp-awards/server";
import { isAwardHubKey } from "@/lib/rh/bp-awards/types";

export const dynamic = "force-dynamic";

/** Edição corrente, quem pode ser indicado e o rascunho do colaborador logado (?previa=1&hub=: pré-visualização do RH). */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const hub = params.get("hub");
    const previewAs = hub === "socio" || isAwardHubKey(hub) ? hub : null;
    return NextResponse.json(await getVoterView({ preview: params.get("previa") === "1", previewAs }), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
