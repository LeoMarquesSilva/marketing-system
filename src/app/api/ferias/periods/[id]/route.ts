import { NextResponse } from "next/server";
import { toApiError, updatePeriod } from "@/lib/ferias/server";
import { periodUpdateSchema } from "@/lib/ferias/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const [{ id }, body] = await Promise.all([context.params, request.json()]);
    const parsed = periodUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos.", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }
    return NextResponse.json({ period: await updatePeriod(id, parsed.data) });
  } catch (error) {
    const apiError = toApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
