import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { createOrgMember, loadOrgChartData, type OrgMemberInput } from "@/lib/rh/org-chart-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await loadOrgChartData());
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as OrgMemberInput;
    await createOrgMember(body);
    return NextResponse.json(await loadOrgChartData());
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
