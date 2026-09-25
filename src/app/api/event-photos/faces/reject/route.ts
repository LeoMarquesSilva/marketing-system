import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { eventPhotosErrorResponse, resolveAppUser } from "@/lib/event-photos/server";
import { rejectFaceMatch } from "@/lib/event-photos/faces-server";

export const dynamic = "force-dynamic";

/** "Não sou eu": body `{ photoId }`. */
export async function POST(request: Request) {
  try {
    const authUser = await requireAuthenticatedUser();
    const actor = await resolveAppUser(authUser.id);
    const body = (await request.json().catch(() => ({}))) as { photoId?: unknown };
    await rejectFaceMatch(actor, body.photoId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, error } = eventPhotosErrorResponse(err, "Erro ao remover a marcação.");
    return NextResponse.json({ error }, { status });
  }
}
