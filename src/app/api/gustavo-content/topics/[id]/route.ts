import { NextResponse } from "next/server";
import { updateTopic } from "@/lib/gustavo-content/topics";
import {
  GustavoContentError,
  gustavoContentErrorResponse,
  requireGustavoContentAccess,
} from "@/lib/gustavo-content/server";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireGustavoContentAccess();
    if (!actor.isAdmin) {
      throw new GustavoContentError("Somente admin configura os temas RSS.", 403);
    }
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json(await updateTopic(id, body));
  } catch (err) {
    return gustavoContentErrorResponse(err);
  }
}
