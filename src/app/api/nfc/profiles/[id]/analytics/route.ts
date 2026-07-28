import { NextResponse } from "next/server";
import { requireProfessionalProfileAdmin } from "@/lib/profiles/auth";
import { getProfessionalProfileAnalytics, toProfileApiError } from "@/lib/profiles/admin";

export const dynamic = "force-dynamic";

const DEFAULT_RANGE_DAYS = 30;

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireProfessionalProfileAdmin();
    const { id } = await context.params;

    const url = new URL(request.url);
    const days = Number.parseInt(url.searchParams.get("days") ?? "", 10);
    const rangeDays = Number.isFinite(days) && days > 0 && days <= 365 ? days : DEFAULT_RANGE_DAYS;

    const to = new Date();
    const from = new Date(to.getTime() - rangeDays * 24 * 60 * 60 * 1000);

    // Agregação server-side: a UI não recebe dump de evento bruto.
    return NextResponse.json({ analytics: await getProfessionalProfileAnalytics(id, { from, to }) });
  } catch (error) {
    const apiError = toProfileApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
