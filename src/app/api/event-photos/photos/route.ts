import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import {
  deleteEventPhotos,
  eventPhotosErrorResponse,
  resolveAppUser,
} from "@/lib/event-photos/server";

export const dynamic = "force-dynamic";

/** Exclusão em lote: body `{ photoIds: string[] }`. */
export async function DELETE(request: Request) {
  try {
    const authUser = await requireAuthenticatedUser();
    const actor = await resolveAppUser(authUser.id);
    const body = (await request.json().catch(() => ({}))) as { photoIds?: unknown };
    const deletedIds = await deleteEventPhotos(actor, body.photoIds);
    return NextResponse.json({ deletedIds });
  } catch (err) {
    const { status, error } = eventPhotosErrorResponse(err, "Erro ao apagar fotos.");
    return NextResponse.json({ error }, { status });
  }
}
