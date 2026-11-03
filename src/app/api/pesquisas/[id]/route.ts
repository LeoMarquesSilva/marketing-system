import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { deleteSurvey, getSurveyDetail, updateSurvey } from "@/lib/pesquisas/server";
import { surveyUpdateSchema } from "@/lib/pesquisas/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    return NextResponse.json(await getSurveyDetail(id));
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

/** Salva o que mudou: textos, público, perguntas, prazo ou status. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const parsed = surveyUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos.", code: "INVALID_INPUT" }, { status: 400 });
    }
    return NextResponse.json(await updateSurvey(id, parsed.data));
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await deleteSurvey(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
