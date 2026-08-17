import { NextResponse } from "next/server";
import { z } from "zod";
import {
  clearQualificationRequirements,
  requestQualificationsForSelection,
  toRhApiError,
} from "@/lib/rh/qualifications/server";

const requestSchema = z.object({
  user_ids: z.array(z.string().uuid()).min(1).max(200),
});

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Selecione pelo menos um colaborador.",
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }

    const result = await requestQualificationsForSelection(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

export async function DELETE() {
  try {
    const clearedCount = await clearQualificationRequirements();
    return NextResponse.json({ clearedCount });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
