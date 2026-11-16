import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { getPlanDetail, updateActionProgress } from "@/lib/rh/pdi/server";
import type { PdiProgressInput } from "@/lib/rh/pdi/types";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json()) as PdiProgressInput;
    const planId = await updateActionProgress(id, body);
    return NextResponse.json({ plan: await getPlanDetail(planId) });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
