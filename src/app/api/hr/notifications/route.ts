import { NextResponse } from "next/server";
import { listPendingHrNotifications, toRhApiError } from "@/lib/hr/notifications/server";
import { countOrgChartAdjustments } from "@/lib/rh/org-chart-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [notifications, orgChartAdjustments] = await Promise.all([
      listPendingHrNotifications(),
      countOrgChartAdjustments().catch((error) => {
        console.error("[hr/notifications] organograma:", error);
        return 0;
      }),
    ]);
    return NextResponse.json({ notifications, orgChartAdjustments });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
