import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { eventPhotosErrorResponse, resolveAppUser } from "@/lib/event-photos/server";
import { searchShareLogos } from "@/lib/event-photos/share-logos-server";

export const dynamic = "force-dynamic";

/** ?q=pague → logos do cadastro de clientes para a página do convidado. */
export async function GET(request: Request) {
  try {
    const authUser = await requireAuthenticatedUser();
    const actor = await resolveAppUser(authUser.id);
    const query = new URL(request.url).searchParams.get("q") ?? "";
    return NextResponse.json({ logos: await searchShareLogos(actor, query) });
  } catch (err) {
    const { status, error } = eventPhotosErrorResponse(err, "Erro ao buscar logos.");
    return NextResponse.json({ error }, { status });
  }
}
