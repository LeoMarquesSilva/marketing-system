import { NextResponse } from "next/server";
import { fetchEmployeeDetail, toApiError, updateEmployee } from "@/lib/ferias/server";
import { employeeUpdateSchema } from "@/lib/ferias/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const detail = await fetchEmployeeDetail(id);
    if (!detail) {
      return NextResponse.json(
        { error: "Colaborador não encontrado.", code: "NOT_FOUND" },
        { status: 404 }
      );
    }
    return NextResponse.json(detail);
  } catch (error) {
    const apiError = toApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const [{ id }, body] = await Promise.all([context.params, request.json()]);
    const parsed = employeeUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos.", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }
    return NextResponse.json({ employee: await updateEmployee(id, parsed.data) });
  } catch (error) {
    const apiError = toApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
