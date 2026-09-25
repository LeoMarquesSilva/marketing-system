import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import {
  eventPhotosErrorResponse,
  getEventAlbumDetail,
  isEventPhotosManager,
  resolveAppUser,
} from "@/lib/event-photos/server";
import { listMyMatchedPhotoIds } from "@/lib/event-photos/faces-server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const authUser = await requireAuthenticatedUser();
    const actor = await resolveAppUser(authUser.id);
    const { slug } = await context.params;
    const detail = await getEventAlbumDetail(actor, slug);
    const myPhotoIds = await listMyMatchedPhotoIds(actor, detail.album.id);
    return NextResponse.json({ ...detail, myPhotoIds, canManage: isEventPhotosManager(actor) });
  } catch (err) {
    const { status, error } = eventPhotosErrorResponse(err, "Erro ao carregar álbum.");
    return NextResponse.json({ error }, { status });
  }
}
