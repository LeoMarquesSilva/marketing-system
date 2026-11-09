import { NextResponse } from "next/server";
import { createGoal, goalCreateSchema, toPe27ApiError } from "@/lib/pe27/server";

export const dynamic = "force-dynamic";

/** Nova meta dentro de uma alavanca (criada na revisão dos sócios). */
export async function POST(request: Request) {
  try {
    const parsed = goalCreateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos.", code: "INVALID_INPUT" }, { status: 400 });
    }
    return NextResponse.json({ id: await createGoal(parsed.data) }, { status: 201 });
  } catch (error) {
    const apiError = toPe27ApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
