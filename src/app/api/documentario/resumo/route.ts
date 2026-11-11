import { NextResponse } from "next/server";
import { loadDocSummaryForEvent, toDocApiError } from "@/lib/documentario/server";

export const dynamic = "force-dynamic";

/** Cartão do documentário na página do evento (só para quem tem acesso ao documentário). */
export async function GET(request: Request) {
  try {
    const eventId = new URL(request.url).searchParams.get("evento") ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(eventId)) return NextResponse.json({ summary: null });
    return NextResponse.json({ summary: await loadDocSummaryForEvent(eventId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const apiError = toDocApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
