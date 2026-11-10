import { NextResponse } from "next/server";
import { deleteGoal, goalPatchSchema, toPe27ApiError, updateGoal } from "@/lib/pe27/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Decisão dos sócios, texto, alavanca e dados da meta oficial (ponto de partida, alvo, fonte). */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const parsed = goalPatchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos.", code: "INVALID_INPUT" }, { status: 400 });
    }
    await updateGoal(id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const apiError = toPe27ApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await deleteGoal(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const apiError = toPe27ApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
