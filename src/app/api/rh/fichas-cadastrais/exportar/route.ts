import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { loadEmployeeRegistrationsForExport } from "@/lib/rh/registration/employees-server";
import { exportFilename } from "@/lib/rh/registration/export";
import { buildRegistrationsWorkbook } from "@/lib/rh/registration/export-excel";

export const dynamic = "force-dynamic";

/**
 * Planilha com os dados cadastrais dos colaboradores (RH). Recebe os ids que
 * estavam filtrados na tela; sem ids, exporta todos.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { employeeIds?: unknown; filters?: unknown };
    const employeeIds = Array.isArray(body.employeeIds)
      ? body.employeeIds.filter((id): id is string => typeof id === "string" && id.length > 0).slice(0, 2000)
      : undefined;
    const records = await loadEmployeeRegistrationsForExport(employeeIds);
    const filters = typeof body.filters === "string" ? body.filters.slice(0, 500) : "";
    const data = await buildRegistrationsWorkbook(records, new Date(), filters);
    return new NextResponse(data, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${exportFilename()}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
