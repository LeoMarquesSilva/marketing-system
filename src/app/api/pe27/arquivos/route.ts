import { NextResponse } from "next/server";
import { signedPe27FileUrl, toPe27ApiError } from "@/lib/pe27/server";

export const dynamic = "force-dynamic";

/** Abre (ou baixa, com ?baixar=1) um arquivo do bucket privado do PE27 por link assinado. */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const signed = await signedPe27FileUrl(params.get("caminho") ?? "", params.get("baixar") === "1");
    // O link assinado vale 10 min; 5 min de cache deixam a miniatura e o modal do cartaz usarem o mesmo download.
    return NextResponse.redirect(signed, { status: 302, headers: { "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    const apiError = toPe27ApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
