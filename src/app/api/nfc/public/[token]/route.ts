import { NextRequest, NextResponse } from "next/server";
import { generateAnonymousSessionId } from "@/lib/nfc/security";
import { resolvePublicNfcTag, toApiError } from "@/lib/nfc/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SESSION_COOKIE = "orq_nfc_session";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const existingSession = request.cookies.get(SESSION_COOKIE)?.value;
  const anonymousSessionId = existingSession || generateAnonymousSessionId();
  try {
    const { token } = await context.params;
    const result = await resolvePublicNfcTag({
      token,
      request,
      anonymousSessionId,
    });
    const response = NextResponse.json(result, {
      status:
        result.state === "not_found"
          ? 404
          : result.state === "rate_limited"
            ? 429
            : result.state === "login_required"
              ? 401
              : result.state === "access_denied"
                ? 403
                : 200,
      headers: {
        "cache-control": "private, no-store, max-age=0",
      },
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
    if (result.retryAfterSeconds) {
      response.headers.set("retry-after", String(result.retryAfterSeconds));
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

