import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { saveTemplate } from "@/lib/rh/feedback/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    return NextResponse.json(await saveTemplate((await request.json()) as Parameters<typeof saveTemplate>[0]));
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
