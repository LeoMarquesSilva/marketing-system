import { NextResponse } from "next/server";
import { z } from "zod";
import { reelCoverRequestSchema } from "@/lib/reel-deliveries/domain";
import { getReelDelivery, requestReelCover, toReelDeliveryApiError } from "@/lib/reel-deliveries/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = z.string().uuid().safeParse((await context.params).id);
  if (!id.success) return NextResponse.json({ error: "Reel não encontrado." }, { status: 404 });
  // Corpo opcional: só traz o recado para a designer.
  const body = reelCoverRequestSchema.safeParse((await request.json().catch(() => null)) ?? {});
  if (!body.success) return NextResponse.json({ error: "Recado inválido para a designer." }, { status: 400 });
  try {
    await requestReelCover(id.data, body.data);
    return NextResponse.json({ delivery: await getReelDelivery(id.data) }, { status: 201 });
  } catch (error) {
    const api = toReelDeliveryApiError(error);
    return NextResponse.json({ error: api.message }, { status: api.status });
  }
}
