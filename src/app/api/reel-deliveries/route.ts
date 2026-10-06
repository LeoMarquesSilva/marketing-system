import { NextResponse } from "next/server";
import { createReelDeliverySchema } from "@/lib/reel-deliveries/domain";
import {
  createReelDelivery,
  listReelDeliveries,
  toReelDeliveryApiError,
} from "@/lib/reel-deliveries/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await listReelDeliveries());
  } catch (error) {
    const api = toReelDeliveryApiError(error);
    return NextResponse.json({ error: api.message }, { status: api.status });
  }
}

export async function POST(request: Request) {
  const parsed = createReelDeliverySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Revise a data, o título, as pessoas e o vídeo." }, { status: 400 });
  }
  try {
    const id = await createReelDelivery(parsed.data);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    const api = toReelDeliveryApiError(error);
    return NextResponse.json({ error: api.message }, { status: api.status });
  }
}
