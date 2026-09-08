import { NextResponse } from "next/server";
import { requireProfessionalProfileAdmin } from "@/lib/profiles/auth";
import {
  ReadingTrajectoryError,
  readingTrajectoryApiError,
  uploadReadingCover,
} from "@/lib/reading-trajectories/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireProfessionalProfileAdmin();
    const { id } = await context.params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new ReadingTrajectoryError("Selecione uma capa.", 400, "READING_COVER_REQUIRED");
    }
    return NextResponse.json({ item: await uploadReadingCover(id, file, admin.userId) });
  } catch (error) {
    const result = readingTrajectoryApiError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
