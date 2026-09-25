import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import {
  eventPhotosErrorResponse,
  registerEventPhoto,
  resolveAppUser,
} from "@/lib/event-photos/server";
import { saveUploadMatches } from "@/lib/event-photos/faces-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await requireAuthenticatedUser();
    const actor = await resolveAppUser(authUser.id);
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const photo = await registerEventPhoto(actor, id, body);
    // Falha no reconhecimento não desfaz a foto: ela já está no álbum.
    await saveUploadMatches(photo.id, body.faceMatches).catch((err) =>
      console.error("[event-photos] falha ao salvar reconhecimento facial", err)
    );
    return NextResponse.json({ photo });
  } catch (err) {
    const { status, error } = eventPhotosErrorResponse(err, "Erro ao registrar foto.");
    return NextResponse.json({ error }, { status });
  }
}
