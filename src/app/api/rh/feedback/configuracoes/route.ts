import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { saveSettings } from "@/lib/rh/feedback/server";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  try {
    await saveSettings((await request.json()) as Parameters<typeof saveSettings>[0]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
