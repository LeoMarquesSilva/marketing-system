import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import {
  PhotoHttpError,
  resolveAppUser,
  setPhotoUsage,
} from "@/lib/collaborator-photos/server";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  try {
    const authUser = await requireAuthenticatedUser();
    const actor = await resolveAppUser(authUser.id);
    const body = (await request.json()) as {
      photoId?: string;
      usageTypeId?: string;
      assigned?: boolean;
    };
    if (!body.photoId || !body.usageTypeId || typeof body.assigned !== "boolean") {
      return NextResponse.json({ error: "Informe foto, uso e se está marcado." }, { status: 400 });
    }
    const photos = await setPhotoUsage(actor, {
      photoId: body.photoId,
      usageTypeId: body.usageTypeId,
      assigned: body.assigned,
    });
    return NextResponse.json({ photos });
  } catch (err) {
    if (err instanceof PhotoHttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Erro ao salvar uso.";
    const status = message.includes("Não autenticado") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
