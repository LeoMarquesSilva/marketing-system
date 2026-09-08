import { NextResponse } from "next/server";
import { requireProfessionalProfileAdmin } from "@/lib/profiles/auth";
import {
  ReadingTrajectoryError,
  readingTrajectoryApiError,
  updateReadingRecommendation,
} from "@/lib/reading-trajectories/server";
import { readingRecommendationUpdateSchema } from "@/lib/reading-trajectories/validation";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireProfessionalProfileAdmin();
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = readingRecommendationUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ReadingTrajectoryError(
        parsed.error.issues[0]?.message ?? "Dados inválidos.",
        400,
        "READING_INVALID"
      );
    }
    const item = await updateReadingRecommendation(id, parsed.data, admin.userId);
    return NextResponse.json({ item });
  } catch (error) {
    const result = readingTrajectoryApiError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
