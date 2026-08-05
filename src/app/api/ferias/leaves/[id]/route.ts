import { NextResponse } from "next/server";
import { deleteLeave, toApiError, updateLeave } from "@/lib/ferias/server";
import { leaveUpdateSchema } from "@/lib/ferias/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const [{ id }, body] = await Promise.all([context.params, request.json()]);
    const parsed = leaveUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos.", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }
    return NextResponse.json({ leave: await updateLeave(id, parsed.data) });
  } catch (error) {
    const apiError = toApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await deleteLeave(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const apiError = toApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
