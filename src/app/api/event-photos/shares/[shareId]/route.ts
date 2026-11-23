import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { eventPhotosErrorResponse, resolveAppUser } from "@/lib/event-photos/server";
import { updateAlbumShare } from "@/lib/event-photos/shares-server";

export const dynamic = "force-dynamic";

/** { revoke: true } desativa o link; { allowDownload } libera ou bloqueia o download. */
export async function PATCH(request: Request, context: { params: Promise<{ shareId: string }> }) {
  try {
    const authUser = await requireAuthenticatedUser();
    const actor = await resolveAppUser(authUser.id);
    const { shareId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json({ share: await updateAlbumShare(actor, shareId, body) });
  } catch (err) {
    const { status, error } = eventPhotosErrorResponse(err, "Erro ao atualizar o link.");
    return NextResponse.json({ error }, { status });
  }
}
