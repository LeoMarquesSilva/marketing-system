import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import {
  CafeCulturaError,
  getCafeProfileForAuthUser,
  registerCafeCheckin,
} from "@/lib/cafe-cultura/server";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof CafeCulturaError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Não foi possível registrar sua presença.";
  const status = /não autenticado/i.test(message) ? 401 : 500;
  return NextResponse.json(
    { error: status === 401 ? "Entre no ORQESTRAI para continuar." : "Não foi possível registrar sua presença." },
    { status }
  );
}
export async function POST(request: Request) {
  try {
    const authUser = await requireAuthenticatedUser();
    const profile = await getCafeProfileForAuthUser(authUser.id);
    const body = await request.json().catch(() => ({}));
    const source = body?.source === "qr" ? "qr" : "nfc";
    const current = await registerCafeCheckin(profile.id, new Date(), source);
    return NextResponse.json({ success: true, current });
  } catch (error) {
    return errorResponse(error);
  }
}
