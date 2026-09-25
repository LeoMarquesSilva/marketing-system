import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import {
  deleteEventAlbum,
  eventPhotosErrorResponse,
  resolveAppUser,
  updateEventAlbum,
} from "@/lib/event-photos/server";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await requireAuthenticatedUser();
    const actor = await resolveAppUser(authUser.id);
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const album = await updateEventAlbum(actor, id, body);
    return NextResponse.json({ album });
  } catch (err) {
    const { status, error } = eventPhotosErrorResponse(err, "Erro ao atualizar álbum.");
    return NextResponse.json({ error }, { status });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await requireAuthenticatedUser();
    const actor = await resolveAppUser(authUser.id);
    const { id } = await context.params;
    await deleteEventAlbum(actor, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, error } = eventPhotosErrorResponse(err, "Erro ao apagar álbum.");
    return NextResponse.json({ error }, { status });
  }
}
