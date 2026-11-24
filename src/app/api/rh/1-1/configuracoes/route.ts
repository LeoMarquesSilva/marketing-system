import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { saveSettings } from "@/lib/rh/one-on-one/server";
import type { OneOnOneSettings } from "@/lib/rh/one-on-one/types";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  try {
    await saveSettings((await request.json()) as Partial<OneOnOneSettings>);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
