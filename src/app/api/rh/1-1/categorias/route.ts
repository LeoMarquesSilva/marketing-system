import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { saveCategory } from "@/lib/rh/one-on-one/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const saved = await saveCategory((await request.json()) as Parameters<typeof saveCategory>[0]);
    return NextResponse.json({ ok: true, id: saved.id });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
