import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { manualSignedUrl } from "@/lib/rh/boas-praticas/server";
import { GOOD_PRACTICES_MANUAL } from "@/lib/rh/boas-praticas/types";

export const dynamic = "force-dynamic";

/** Abre o Manual de Boas Práticas (link assinado); ?pagina=8 abre direto na página do capítulo. */
export async function GET(request: Request) {
  try {
    const page = Number(new URL(request.url).searchParams.get("pagina"));
    const url = await manualSignedUrl();
    const valid = Number.isInteger(page) && page >= 1 && page <= GOOD_PRACTICES_MANUAL.pages;
    const response = NextResponse.redirect(valid ? `${url}#page=${page}` : url, 303);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
