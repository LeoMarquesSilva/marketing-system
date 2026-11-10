import { NextResponse, type NextRequest } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { parseGuestAnswer } from "@/lib/festa-convite";
import { getGuestInviteView, saveGuestAnswer } from "@/lib/festa-convite-server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/** Quem está logado no ORQESTRAI é do escritório: a visita não conta como abertura do cliente. */
function hasOfficeSession(request: NextRequest): boolean {
  return request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"));
}

/** Convite do cliente pelo link pessoal (sem login: o segredo é o link). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const preview = request.nextUrl.searchParams.get("previa") === "1" || hasOfficeSession(request);
    return NextResponse.json(await getGuestInviteView(token, { track: true, preview }), { headers: NO_STORE });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

/** Resposta do cliente: vai ou não vai, 1 convidado e restrição alimentar. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const answer = parseGuestAnswer(await request.json().catch(() => null));
    if (!answer) {
      return NextResponse.json(
        { error: "Diga se você vem e, se for trazer um convidado, o nome dele.", code: "INVALID" },
        { status: 400 }
      );
    }
    return NextResponse.json(await saveGuestAnswer(token, answer), { headers: NO_STORE });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
