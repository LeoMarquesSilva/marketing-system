import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { listEmployeeRegistrations } from "@/lib/rh/registration/employees-server";

/** Todos os colaboradores com a situação da ficha cadastral (RH). */
export async function GET() {
  try {
    const items = await listEmployeeRegistrations();
    return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
