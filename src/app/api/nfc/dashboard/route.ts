import { NextResponse } from "next/server";
import { getNfcDashboard, toApiError } from "@/lib/nfc/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    return NextResponse.json(
      await getNfcDashboard({
        days: Number(searchParams.get("days") || 30),
        environment: searchParams.get("environment") || undefined,
        category: searchParams.get("category") || undefined,
        status: searchParams.get("status") || undefined,
        actionType: searchParams.get("actionType") || undefined,
      })
    );
  } catch (error) {
    const apiError = toApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
