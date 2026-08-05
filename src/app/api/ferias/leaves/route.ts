import { NextResponse } from "next/server";
import { createLeave, toApiError } from "@/lib/ferias/server";
import { leaveCreateSchema } from "@/lib/ferias/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const parsed = leaveCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos.", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }
    return NextResponse.json({ leave: await createLeave(parsed.data) }, { status: 201 });
  } catch (error) {
    const apiError = toApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
