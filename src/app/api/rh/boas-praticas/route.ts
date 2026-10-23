import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { createFeedback, listFeedbacks } from "@/lib/rh/boas-praticas/server";
import type { FeedbackInput } from "@/lib/rh/boas-praticas/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ items: await listFeedbacks() });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FeedbackInput;
    return NextResponse.json({ item: await createFeedback(body) });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
