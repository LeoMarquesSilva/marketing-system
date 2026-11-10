import { NextResponse } from "next/server";
import { HomeHttpError, homeGoodPracticesManualUrl } from "@/lib/inicio/server";

export const dynamic = "force-dynamic";

/** Abre o Manual de Boas Práticas (PDF, link assinado) para quem está logado. */
export async function GET() {
  try {
    const response = NextResponse.redirect(await homeGoodPracticesManualUrl(), 303);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    const status = error instanceof HomeHttpError ? error.status : 500;
    const message = error instanceof HomeHttpError ? error.message : "O manual não está disponível agora.";
    if (!(error instanceof HomeHttpError)) console.error("[inicio] manual:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: message }, { status });
  }
}
