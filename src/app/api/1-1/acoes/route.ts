import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { createAction } from "@/lib/rh/one-on-one/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await createAction((await request.json()) as Parameters<typeof createAction>[0]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
