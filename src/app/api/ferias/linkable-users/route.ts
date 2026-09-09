import { NextResponse } from "next/server";
import { listLinkableUsersWithOccupancy, toApiError } from "@/lib/ferias/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await listLinkableUsersWithOccupancy());
  } catch (error) {
    const apiError = toApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
