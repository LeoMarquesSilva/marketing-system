import { NextRequest, NextResponse } from "next/server";
import { generateAnonymousSessionId } from "@/lib/nfc/security";
import { executePublicNfcAction, toApiError } from "@/lib/nfc/server";
import { nfcExecutionInputSchema } from "@/lib/nfc/validation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SESSION_COOKIE = "orq_nfc_session";
type RouteContext = { params: Promise<{ token: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const existingSession = request.cookies.get(SESSION_COOKIE)?.value;
  const anonymousSessionId = existingSession || generateAnonymousSessionId();
  try {
    const [{ token }, body] = await Promise.all([context.params, request.json()]);
    const parsed = nfcExecutionInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos.", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }
    const result = await executePublicNfcAction({
      token,
      request,
      anonymousSessionId,
      ...parsed.data,
    });
    const response = NextResponse.json(result, {
      headers: { "cache-control": "private, no-store, max-age=0" },
    });
    if (!existingSession) {
      response.cookies.set(SESSION_COOKIE, anonymousSessionId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });
    }
    return response;
  } catch (error) {
    const apiError = toApiError(error);
    return NextResponse.json(apiError.body, {
      status: apiError.status,
      headers: { "cache-control": "private, no-store, max-age=0" },
    });
  }
}
