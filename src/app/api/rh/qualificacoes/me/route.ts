import { NextResponse } from "next/server";
import {
  getMyQualification,
  toRhApiError,
  upsertMyQualification,
} from "@/lib/rh/qualifications/server";
import { qualificationUpsertSchema } from "@/lib/rh/qualifications/validation";

export async function GET() {
  try {
    const qualification = await getMyQualification();
    return NextResponse.json({ qualification });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

export async function PUT(request: Request) {
  try {
    const parsed = qualificationUpsertSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Dados inválidos.",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }
    const qualification = await upsertMyQualification(parsed.data);
    return NextResponse.json({ qualification });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
