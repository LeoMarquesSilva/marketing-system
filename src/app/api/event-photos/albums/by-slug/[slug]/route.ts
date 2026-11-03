import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import {
  eventPhotosErrorResponse,
  getEventAlbumDetail,
  isEventPhotosManager,
  resolveAppUser,
} from "@/lib/event-photos/server";
import { listMyAlbumMatches } from "@/lib/event-photos/faces-server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const authUser = await requireAuthenticatedUser();
    const actor = await resolveAppUser(authUser.id);
    const { slug } = await context.params;
    const detail = await getEventAlbumDetail(actor, slug);
    const mine = await listMyAlbumMatches(actor, detail.album.id);
    return NextResponse.json({
      ...detail,
      myPhotoIds: mine.sure,
      myMaybePhotoIds: mine.maybe,
      canManage: isEventPhotosManager(actor),
    });
  } catch (err) {
    const { status, error } = eventPhotosErrorResponse(err, "Erro ao carregar álbum.");
    return NextResponse.json({ error }, { status });
  }
}
