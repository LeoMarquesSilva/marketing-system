import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { getPairDetail } from "@/lib/rh/one-on-one/server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ lider: string; liderado: string }> }) {
  try {
    const { lider, liderado } = await params;
    return NextResponse.json(await getPairDetail(lider, liderado));
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
