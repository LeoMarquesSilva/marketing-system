import { NextResponse } from "next/server";
import { canPerformGustavoContentAction } from "@/lib/gustavo-content/access";
import {
  gustavoContentErrorResponse,
  GustavoContentError,
  requireGustavoContentAccess,
} from "@/lib/gustavo-content/server";
import {
  getStrategy,
  updateStrategy,
} from "@/lib/gustavo-content/strategy-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireGustavoContentAccess();
    return NextResponse.json(await getStrategy());
  } catch (err) {
    return gustavoContentErrorResponse(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireGustavoContentAccess();
    if (!canPerformGustavoContentAction(actor, "edit_strategy")) {
      throw new GustavoContentError("Sem permissão para editar a estratégia.", 403);
    }
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(await updateStrategy(body, actor.id));
  } catch (err) {
    return gustavoContentErrorResponse(err);
  }
}
