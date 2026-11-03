import { NextResponse } from "next/server";
import { z } from "zod";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { createSurvey, listSurveys } from "@/lib/pesquisas/server";
import { SURVEY_TEMPLATES } from "@/lib/pesquisas/templates";
import { SURVEY_BRANDS } from "@/lib/pesquisas/types";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().trim().min(1, "Dê um título à pesquisa.").max(160),
  template: z.enum(SURVEY_TEMPLATES).default("em_branco"),
  audience_departments: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  brand: z.enum(SURVEY_BRANDS).nullable().default(null),
});

/** Pesquisas com a equipe (quem gerencia). */
export async function GET() {
  try {
    return NextResponse.json({ surveys: await listSurveys() });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

export async function POST(request: Request) {
  try {
    const parsed = createSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos.", code: "INVALID_INPUT" }, { status: 400 });
    }
    return NextResponse.json({ survey: await createSurvey(parsed.data) }, { status: 201 });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
