import { NextResponse } from "next/server";
import { listRecess, toApiError, upsertRecess } from "@/lib/ferias/server";
import { recessCreateSchema } from "@/lib/ferias/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ recess: await listRecess() });
  } catch (error) {
    const apiError = toApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

export async function POST(request: Request) {
  try {
    const parsed = recessCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos.", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }
    return NextResponse.json({ recess: await upsertRecess(parsed.data) }, { status: 201 });
  } catch (error) {
    const apiError = toApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
