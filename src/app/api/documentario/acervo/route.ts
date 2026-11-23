import { NextResponse } from "next/server";
import { loadDocArchive, toDocApiError } from "@/lib/documentario/server";

export const dynamic = "force-dynamic";

/** Lista do acervo com links assinados novos (a tela pede de novo quando os links vencem). */
export async function GET() {
  try {
    return NextResponse.json({ items: await loadDocArchive() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const apiError = toDocApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
