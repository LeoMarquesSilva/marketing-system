import { NextResponse } from "next/server";
import { resolvePublicSurvey, submitSurveyResponse } from "@/lib/nps/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const result = await resolvePublicSurvey(token, request);

    if (result.state === "not_found") {
      return NextResponse.json({ state: result.state, message: result.message }, { status: 404 });
    }
    if (result.state === "rate_limited") {
      return NextResponse.json({ state: result.state, message: result.message }, { status: 429 });
    }
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao carregar pesquisa.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const result = await submitSurveyResponse(token, body, request);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.message, code: result.code },
        { status: result.status }
      );
    }
    return NextResponse.json({ success: true, responseId: result.responseId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao enviar resposta.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
