import { NextResponse } from "next/server";
import { signedArchiveUrl, toDocApiError } from "@/lib/documentario/server";

export const dynamic = "force-dynamic";

/** Abre (ou baixa, com ?baixar=1) um arquivo do acervo privado por link assinado. */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const signed = await signedArchiveUrl(params.get("id") ?? "", params.get("baixar") === "1");
    return NextResponse.redirect(signed, { status: 302, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const apiError = toDocApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
