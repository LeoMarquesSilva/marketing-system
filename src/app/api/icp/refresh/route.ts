import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { requireAdminUser, requireAuthenticatedUser } from "@/lib/api-auth";
import { ICP_CACHE_TAG } from "@/lib/icp/server";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await requireAuthenticatedUser();
    await requireAdminUser(user.id);
    revalidateTag(ICP_CACHE_TAG, { expire: 0 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao recalcular o ICP.";
    const status = message.includes("Não autenticado") || message.includes("inativo")
      ? 401
      : message.includes("administradores")
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
