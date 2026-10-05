import { NextResponse } from "next/server";
import { z } from "zod";
import { reelCopyRequestSchema } from "@/lib/reel-deliveries/domain";
import { generateReelCopy, getReelDelivery, toReelDeliveryApiError } from "@/lib/reel-deliveries/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = z.string().uuid().safeParse((await context.params).id);
  if (!id.success) return NextResponse.json({ error: "Reel não encontrado." }, { status: 404 });
  const parsed = reelCopyRequestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Pedido inválido para a IA." }, { status: 400 });
  try {
    await generateReelCopy(id.data, parsed.data);
    return NextResponse.json({ delivery: await getReelDelivery(id.data) });
  } catch (error) {
    const api = toReelDeliveryApiError(error);
    return NextResponse.json({ error: api.message }, { status: api.status });
  }
}
