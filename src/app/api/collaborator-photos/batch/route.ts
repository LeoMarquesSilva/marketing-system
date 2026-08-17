import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import {
  PhotoHttpError,
  deletePhotosBatch,
  movePhotosToSession,
  resolveAppUser,
} from "@/lib/collaborator-photos/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type BatchBody = {
  action?: unknown;
  photoIds?: unknown;
  sessionId?: unknown;
};

export async function POST(request: Request) {
  try {
    const authUser = await requireAuthenticatedUser();
    const actor = await resolveAppUser(authUser.id);
    const body = (await request.json().catch(() => ({}))) as BatchBody;

    if (body.action === "delete") {
      const result = await deletePhotosBatch(actor, body.photoIds);
      return NextResponse.json({ success: true, ...result });
    }

    if (body.action === "move-session") {
      const photos = await movePhotosToSession(actor, {
        photoIds: body.photoIds,
        sessionId: body.sessionId,
      });
      return NextResponse.json({ photos });
    }

    return NextResponse.json(
      { error: "Ação inválida. Use delete ou move-session." },
      { status: 400 }
    );
  } catch (err) {
    if (err instanceof PhotoHttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Erro na ação em lote.";
    const status = message.includes("Não autenticado") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
