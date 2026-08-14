import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { isCollaboratorPhotosManager } from "@/lib/access-control";
import {
  PhotoHttpError,
  assertCanViewGallery,
  createPhotoRecord,
  listGalleryForUser,
  listOfficialStatusByUserIds,
  listPhotoCountsByUserIds,
  resolveAppUser,
} from "@/lib/collaborator-photos/server";

export const dynamic = "force-dynamic";

function jsonError(err: unknown) {
  if (err instanceof PhotoHttpError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : "Erro nas fotos.";
  const status = message.includes("Não autenticado") ? 401 : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const authUser = await requireAuthenticatedUser();
    const actor = await resolveAppUser(authUser.id);
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") || actor.id;
    const summary = url.searchParams.get("summary") === "1";

    if (summary) {
      if (!isCollaboratorPhotosManager({ id: actor.id, role: actor.role, permissions: actor.permissions })) {
        return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
      }
      const ids = (url.searchParams.get("userIds") ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      const [officialByUserId, photoCountByUserId] = await Promise.all([
        listOfficialStatusByUserIds(ids.length ? ids : undefined),
        listPhotoCountsByUserIds(ids.length ? ids : undefined),
      ]);
      return NextResponse.json({ officialByUserId, photoCountByUserId });
    }

    await assertCanViewGallery(actor, userId);
    const photos = await listGalleryForUser(userId);
    return NextResponse.json({ photos, userId });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await requireAuthenticatedUser();
    const actor = await resolveAppUser(authUser.id);
    const body = (await request.json()) as {
      userId?: string;
      storagePath?: string;
      publicUrl?: string;
      originalFilename?: string | null;
    };
    if (!body.userId || !body.storagePath || !body.publicUrl) {
      return NextResponse.json({ error: "Dados da foto incompletos." }, { status: 400 });
    }
    const photo = await createPhotoRecord(actor, {
      userId: body.userId,
      storagePath: body.storagePath,
      publicUrl: body.publicUrl,
      originalFilename: body.originalFilename,
    });
    return NextResponse.json({ photo });
  } catch (err) {
    return jsonError(err);
  }
}
