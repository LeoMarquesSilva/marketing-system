import { NextResponse } from "next/server";
import { getQualificationByUserId, toRhApiError } from "@/lib/rh/qualifications/server";

export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await params;
    const qualification = await getQualificationByUserId(userId);
    return NextResponse.json({ qualification });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
