import { NextResponse } from "next/server";
import { applyRecessToActiveEmployees, toApiError } from "@/lib/ferias/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await applyRecessToActiveEmployees(id);
    return NextResponse.json(result);
  } catch (error) {
    const apiError = toApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
