import { NextResponse } from "next/server";
import { emailLinkOrigin } from "@/lib/public-origin";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { completeOnboarding, getWelcomeOverview } from "@/lib/rh/welcome/server";

export const dynamic = "force-dynamic";

/** Boas-vindas (RH): fila de quem está entrando, concluídos e links. */
export async function GET() {
  try {
    const overview = await getWelcomeOverview();
    return NextResponse.json(overview, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

/** `complete`: conclui o onboarding (ou reenvia), cria o acesso e envia o e-mail. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const origin = emailLinkOrigin(request);
  try {
    if (body.action === "complete" && typeof body.employeeId === "string") {
      const result = await completeOnboarding(
        {
          employeeId: body.employeeId,
          email: typeof body.email === "string" ? body.email : "",
          audienceKey: typeof body.audienceKey === "string" ? body.audienceKey : null,
          employmentType: typeof body.employmentType === "string" ? body.employmentType : null,
        },
        origin
      );
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
