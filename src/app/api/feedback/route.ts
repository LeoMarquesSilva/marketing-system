import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { createFeedback, getOverview } from "@/lib/rh/feedback/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    void request;
    return NextResponse.json(await getOverview());
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

export async function POST(request: Request) {
  try {
    return NextResponse.json(await createFeedback((await request.json()) as Parameters<typeof createFeedback>[0]));
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
