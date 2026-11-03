import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { eventPhotosErrorResponse, resolveAppUser } from "@/lib/event-photos/server";
import { confirmFaceMatch } from "@/lib/event-photos/faces-server";

export const dynamic = "force-dynamic";

/** "Sou eu" numa foto de "Talvez seja você": body `{ photoId }`. */
export async function POST(request: Request) {
  try {
    const authUser = await requireAuthenticatedUser();
    const actor = await resolveAppUser(authUser.id);
    const body = (await request.json().catch(() => ({}))) as { photoId?: unknown };
    await confirmFaceMatch(actor, body.photoId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, error } = eventPhotosErrorResponse(err, "Erro ao confirmar a marcação.");
    return NextResponse.json({ error }, { status });
  }
}
