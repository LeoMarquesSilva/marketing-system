import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { PhotoHttpError, getStorageUsage, resolveAppUser } from "@/lib/collaborator-photos/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const authUser = await requireAuthenticatedUser();
    const actor = await resolveAppUser(authUser.id);
    const usage = await getStorageUsage(actor);
    return NextResponse.json(usage);
  } catch (err) {
    if (err instanceof PhotoHttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Erro ao medir o storage.";
    const status = message.includes("Não autenticado") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
