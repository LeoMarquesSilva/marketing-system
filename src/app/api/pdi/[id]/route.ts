import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { deletePlan, getPlanDetail, updatePlan } from "@/lib/rh/pdi/server";
import type { PdiPlanInput } from "@/lib/rh/pdi/types";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    return NextResponse.json({ plan: await getPlanDetail(id) });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

export async function PUT(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const body = (await request.json()) as PdiPlanInput;
    await updatePlan(id, body);
    return NextResponse.json({ plan: await getPlanDetail(id) });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    await deletePlan(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
