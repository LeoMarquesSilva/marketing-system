import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireCafeCulturaAccess } from "@/lib/api-auth";
import { ensureEventRoster, getCafeAdminData } from "@/lib/cafe-cultura/server";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await requireAuthenticatedUser();
    await requireCafeCulturaAccess(authUser.id);
    const { id } = await params;
    const roster = await ensureEventRoster(id);
    return NextResponse.json({ roster, data: await getCafeAdminData(id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = /não autenticado/i.test(message) ? 401 : /administrador|café com cultura/i.test(message) ? 403 : 500;
    return NextResponse.json({ error: status === 500 ? "Não foi possível atualizar a lista." : message }, { status });
  }
}
