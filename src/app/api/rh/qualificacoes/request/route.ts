import { NextResponse } from "next/server";
import { z } from "zod";
import {
  clearQualificationRequirements,
  requestQualificationsForSelection,
  toRhApiError,
} from "@/lib/rh/qualifications/server";

const requestSchema = z.object({
  scopes: z
    .array(
      z.object({
        area: z.string().trim().min(1),
        positions: z.array(z.string().trim().min(1)).min(1).max(100),
      })
    )
    .min(1)
    .max(50),
});

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Selecione pelo menos uma equipe e um cargo.",
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
