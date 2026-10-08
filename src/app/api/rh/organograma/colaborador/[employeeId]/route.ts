import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { loadOrgChartData, removeEmployeeFromOrgChart } from "@/lib/rh/org-chart-server";

export const dynamic = "force-dynamic";

/** Tira do organograma quem saiu do escritório (todas as posições). */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const { employeeId } = await params;
    await removeEmployeeFromOrgChart(employeeId);
    return NextResponse.json(await loadOrgChartData());
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
