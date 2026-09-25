import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { eventPhotosErrorResponse, resolveAppUser } from "@/lib/event-photos/server";
import { getScanQueue, saveSelfScan } from "@/lib/event-photos/faces-server";

export const dynamic = "force-dynamic";

/** Fotos que o navegador do colaborador ainda precisa varrer. */
export async function GET() {
  try {
    const authUser = await requireAuthenticatedUser();
    const actor = await resolveAppUser(authUser.id);
    return NextResponse.json(await getScanQueue(actor), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    const { status, error } = eventPhotosErrorResponse(err, "Erro ao preparar a busca.");
    return NextResponse.json({ error }, { status });
  }
}

/** Resultado de um álbum varrido: body `{ albumId, matches: [{ photoId, distance }] }`. */
export async function POST(request: Request) {
  try {
    const authUser = await requireAuthenticatedUser();
    const actor = await resolveAppUser(authUser.id);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json(await saveSelfScan(actor, body));
  } catch (err) {
    const { status, error } = eventPhotosErrorResponse(err, "Erro ao salvar a busca.");
    return NextResponse.json({ error }, { status });
  }
}
