import { NextResponse } from "next/server";
import { requireProfessionalProfileAdmin } from "@/lib/profiles/auth";
import {
  getAdminReadingRecommendations,
  readingTrajectoryApiError,
} from "@/lib/reading-trajectories/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireProfessionalProfileAdmin();
    return NextResponse.json(await getAdminReadingRecommendations());
  } catch (error) {
    const result = readingTrajectoryApiError(error);
    return NextResponse.json(result.body, { status: result.status });
  }
}
