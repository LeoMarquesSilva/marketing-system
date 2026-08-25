import { NextResponse } from "next/server";
import { requireAdminUser, requireAuthenticatedUser } from "@/lib/api-auth";
import { getCafeProfileForAuthUser } from "@/lib/cafe-cultura/server";
import { syncResponsumAbsences } from "@/lib/cafe-cultura/responsum";

export const maxDuration = 60;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await requireAuthenticatedUser();
    await requireAdminUser(authUser.id);
    const profile = await getCafeProfileForAuthUser(authUser.id);
    const { id } = await params;
    return NextResponse.json({ success: true, result: await syncResponsumAbsences(id, "admin", profile.id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = /não autenticado/i.test(message) ? 401 : /administrador/i.test(message) ? 403 : 500;
    return NextResponse.json({ error: status === 500 ? "Não foi possível sincronizar com o RESPONSUM." : message }, { status });
  }
}
