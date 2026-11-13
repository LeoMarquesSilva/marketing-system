import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { eventPhotosErrorResponse, resolveAppUser } from "@/lib/event-photos/server";
import { createAlbumShare, listAlbumShares } from "@/lib/event-photos/shares-server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await requireAuthenticatedUser();
    const actor = await resolveAppUser(authUser.id);
    const { id } = await context.params;
    return NextResponse.json({ shares: await listAlbumShares(actor, id) });
  } catch (err) {
    const { status, error } = eventPhotosErrorResponse(err, "Erro ao listar os links.");
    return NextResponse.json({ error }, { status });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await requireAuthenticatedUser();
    const actor = await resolveAppUser(authUser.id);
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json({ share: await createAlbumShare(actor, id, body) });
  } catch (err) {
    const { status, error } = eventPhotosErrorResponse(err, "Erro ao criar o link.");
    return NextResponse.json({ error }, { status });
  }
}
