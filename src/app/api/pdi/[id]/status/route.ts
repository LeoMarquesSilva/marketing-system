import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { changeStatus, getPlanDetail } from "@/lib/rh/pdi/server";
import type { PdiStatus } from "@/lib/rh/pdi/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { status: PdiStatus; note?: string | null };
    await changeStatus(id, body);
    return NextResponse.json({ plan: await getPlanDetail(id) });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
