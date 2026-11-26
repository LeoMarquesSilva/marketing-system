import { NextResponse, type NextRequest } from "next/server";
import { ebook6x1Url, registerDownload6x1 } from "@/lib/leads/server";

export const dynamic = "force-dynamic";

/** Botão "Baixar o e-book": conta o download (no lead e no funil) e abre o PDF. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  await registerDownload6x1({
    leadId: params.get("l"),
    visitorId: params.get("v"),
    userAgent: request.headers.get("user-agent"),
  }).catch(() => undefined);

  const response = NextResponse.redirect(ebook6x1Url(), 302);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
