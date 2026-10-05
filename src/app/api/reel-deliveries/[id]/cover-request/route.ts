import { NextResponse } from "next/server";
import { z } from "zod";
import { getReelDelivery, requestReelCover, toReelDeliveryApiError } from "@/lib/reel-deliveries/server";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const id = z.string().uuid().safeParse((await context.params).id);
  if (!id.success) return NextResponse.json({ error: "Reel não encontrado." }, { status: 404 });
  try {
    await requestReelCover(id.data);
    return NextResponse.json({ delivery: await getReelDelivery(id.data) }, { status: 201 });
  } catch (error) {
    const api = toReelDeliveryApiError(error);
    return NextResponse.json({ error: api.message }, { status: api.status });
  }
}
