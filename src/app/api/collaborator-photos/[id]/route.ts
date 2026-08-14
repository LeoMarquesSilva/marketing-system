import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import {
  PhotoHttpError,
  deletePhoto,
  resolveAppUser,
} from "@/lib/collaborator-photos/server";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireAuthenticatedUser();
    const actor = await resolveAppUser(authUser.id);
    const { id } = await context.params;
    await deletePhoto(actor, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof PhotoHttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Erro ao apagar foto.";
    const status = message.includes("Não autenticado") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
