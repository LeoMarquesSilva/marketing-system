import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { getMyWelcomeLinks } from "@/lib/rh/welcome/server";

export const dynamic = "force-dynamic";

/** Links de boas-vindas da área de quem está logado (Meus links). */
export async function GET() {
  try {
    const data = await getMyWelcomeLinks();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
