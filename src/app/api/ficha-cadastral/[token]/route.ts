import { NextResponse } from "next/server";
import {
  resolvePublicRegistration,
  submitPublicRegistration,
} from "@/lib/rh/registration/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

const STATUS_BY_STATE: Record<string, number> = {
  not_found: 404,
  cancelled: 410,
  expired: 410,
  rate_limited: 429,
};

/** Link público da ficha cadastral (sem login): o token é a credencial. */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const result = await resolvePublicRegistration(token, request);
    return NextResponse.json(result, {
      status: STATUS_BY_STATE[result.state] ?? 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[ficha-cadastral] GET", error);
    return NextResponse.json({ error: "Erro ao carregar a ficha." }, { status: 500 });
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
    const result = await submitPublicRegistration(token, body, request);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.message, code: result.code, fieldErrors: result.fieldErrors },
        { status: result.status }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ficha-cadastral] POST", error);
    return NextResponse.json({ error: "Erro ao enviar a ficha." }, { status: 500 });
  }
}
