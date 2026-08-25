import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import {
  CafeCulturaError,
  getCafeProfileForAuthUser,
  getCurrentCafeForUser,
} from "@/lib/cafe-cultura/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const authUser = await requireAuthenticatedUser();
    const profile = await getCafeProfileForAuthUser(authUser.id);
    const current = await getCurrentCafeForUser(profile.id);
    return NextResponse.json({ current }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    if (error instanceof CafeCulturaError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "";
    const status = /não autenticado/i.test(message) ? 401 : 500;
    return NextResponse.json(
      { error: status === 401 ? "Entre no ORQESTRAI para continuar." : "Não foi possível carregar o encontro." },
      { status }
    );
  }
}
