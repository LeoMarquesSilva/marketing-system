import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { getEmployeeRegistration } from "@/lib/rh/registration/employees-server";

type RouteContext = { params: Promise<{ employeeId: string }> };

/** Ficha de um colaborador com o melhor dado conhecido (painel lateral do RH). */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { employeeId } = await context.params;
    const detail = await getEmployeeRegistration(employeeId);
    return NextResponse.json({ detail }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
