import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import {
  createEventAlbum,
  eventPhotosErrorResponse,
  isEventPhotosManager,
  listEventAlbums,
  resolveAppUser,
} from "@/lib/event-photos/server";
import { listMyMatchCountsByAlbum } from "@/lib/event-photos/faces-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const authUser = await requireAuthenticatedUser();
    const actor = await resolveAppUser(authUser.id);
    const [albums, myCounts] = await Promise.all([
      listEventAlbums(actor),
      listMyMatchCountsByAlbum(actor),
    ]);
    return NextResponse.json({ albums, myCounts, canManage: isEventPhotosManager(actor) });
  } catch (err) {
    const { status, error } = eventPhotosErrorResponse(err, "Erro ao listar álbuns.");
    return NextResponse.json({ error }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await requireAuthenticatedUser();
    const actor = await resolveAppUser(authUser.id);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const album = await createEventAlbum(actor, body);
    return NextResponse.json({ album });
  } catch (err) {
    const { status, error } = eventPhotosErrorResponse(err, "Erro ao criar álbum.");
    return NextResponse.json({ error }, { status });
  }
}
