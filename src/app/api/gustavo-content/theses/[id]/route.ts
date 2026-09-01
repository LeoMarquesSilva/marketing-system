import { NextResponse } from "next/server";
import { createContentFromThesis, updateThesis } from "@/lib/gustavo-content/theses-server";
import {
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
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    if (body.action === "create_content") {
      const result = await createContentFromThesis(id, {
        id: actor.id,
        name: actor.name,
      });
      return NextResponse.json(result);
    }

    const thesis = await updateThesis(id, body, actor.id);
    return NextResponse.json(thesis);
  } catch (err) {
    return gustavoContentErrorResponse(err);
  }
}
