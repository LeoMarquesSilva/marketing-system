import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { getRespondentView, submitSurveyResponse } from "@/lib/pesquisas/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

/** Pesquisa como o colaborador vê (e se já respondeu). */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    return NextResponse.json(await getRespondentView(slug));
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

/** Envia a resposta (uma por pessoa; não dá para editar depois). */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const body = (await request.json().catch(() => null)) as { answers?: unknown } | null;
    return NextResponse.json(await submitSurveyResponse(slug, body?.answers ?? null));
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
