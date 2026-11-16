import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { setDirectManager } from "@/lib/rh/pdi/server";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { employee_id: string; manager_employee_id: string | null };
    await setDirectManager(body.employee_id, body.manager_employee_id ?? null);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
