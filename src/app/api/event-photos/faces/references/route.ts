import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { eventPhotosErrorResponse, resolveAppUser } from "@/lib/event-photos/server";
import { listFaceReferencesForUpload } from "@/lib/event-photos/faces-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const authUser = await requireAuthenticatedUser();
    const actor = await resolveAppUser(authUser.id);
    const people = await listFaceReferencesForUpload(actor);
    return NextResponse.json({ people }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    const { status, error } = eventPhotosErrorResponse(err, "Erro ao carregar referências.");
    return NextResponse.json({ error }, { status });
  }
}
