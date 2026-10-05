import { NextResponse } from "next/server";
import { countPendingReelDeliveries, toReelDeliveryApiError } from "@/lib/reel-deliveries/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ count: await countPendingReelDeliveries() });
  } catch (error) {
    const api = toReelDeliveryApiError(error);
    return NextResponse.json({ error: api.message, count: 0 }, { status: api.status });
  }
}
