import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import {
  deleteOrgMember,
  loadOrgChartData,
  updateOrgMember,
  type OrgMemberInput,
} from "@/lib/rh/org-chart-server";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json()) as OrgMemberInput;
    await updateOrgMember(id, body);
    return NextResponse.json(await loadOrgChartData());
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteOrgMember(id);
    return NextResponse.json(await loadOrgChartData());
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
