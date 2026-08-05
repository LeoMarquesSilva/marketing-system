import { NextResponse } from "next/server";
import { createEmployee, listEmployeesWithBalance, toApiError } from "@/lib/ferias/server";
import { employeeCreateSchema } from "@/lib/ferias/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ employees: await listEmployeesWithBalance() });
  } catch (error) {
    const apiError = toApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

export async function POST(request: Request) {
  try {
    const parsed = employeeCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos.", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }
    return NextResponse.json({ employee: await createEmployee(parsed.data) }, { status: 201 });
  } catch (error) {
    const apiError = toApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
