import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { listAudienceDepartments } from "@/lib/pesquisas/server";

export const dynamic = "force-dynamic";

/** Áreas do cadastro do RH (com quantas pessoas têm login) para escolher o público. */
export async function GET() {
  try {
    return NextResponse.json({ departments: await listAudienceDepartments() });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
