import { NextResponse } from "next/server";
import { z } from "zod";
import { reelDecisionSchema } from "@/lib/reel-deliveries/domain";
import { decideReelDelivery, getReelDelivery, toReelDeliveryApiError } from "@/lib/reel-deliveries/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = z.string().uuid().safeParse((await context.params).id);
  if (!id.success) return NextResponse.json({ error: "Reel não encontrado." }, { status: 404 });
  const parsed = reelDecisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Decisão inválida." },
      { status: 400 }
    );
  }
  try {
    await decideReelDelivery(id.data, parsed.data);
    return NextResponse.json({ delivery: await getReelDelivery(id.data) });
  } catch (error) {
    const api = toReelDeliveryApiError(error);
    return NextResponse.json({ error: api.message }, { status: api.status });
  }
}
