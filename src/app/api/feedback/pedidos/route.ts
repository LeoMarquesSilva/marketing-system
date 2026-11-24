import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { createRequest } from "@/lib/rh/feedback/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    return NextResponse.json(await createRequest((await request.json()) as Parameters<typeof createRequest>[0]));
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
