import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { eventPhotosErrorResponse, resolveAppUser } from "@/lib/event-photos/server";
import { setPhotosGuestHidden } from "@/lib/event-photos/shares-server";

export const dynamic = "force-dynamic";

/** { photoIds, hidden }: tira ou devolve fotos do link de convidado deste álbum. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await requireAuthenticatedUser();
    const actor = await resolveAppUser(authUser.id);
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json({ updatedIds: await setPhotosGuestHidden(actor, id, body) });
  } catch (err) {
    const { status, error } = eventPhotosErrorResponse(err, "Erro ao atualizar as fotos.");
    return NextResponse.json({ error }, { status });
  }
}
