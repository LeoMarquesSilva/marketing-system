import { NextResponse } from "next/server";
import { z } from "zod";
import { addReelVersionSchema } from "@/lib/reel-deliveries/domain";
import { addReelVersion, getReelDelivery, toReelDeliveryApiError } from "@/lib/reel-deliveries/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = z.string().uuid().safeParse((await context.params).id);
  if (!id.success) return NextResponse.json({ error: "Reel não encontrado." }, { status: 404 });
  const parsed = addReelVersionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Envie um vídeo válido." }, { status: 400 });
  try {
    await addReelVersion(id.data, parsed.data);
    return NextResponse.json({ delivery: await getReelDelivery(id.data) }, { status: 201 });
  } catch (error) {
    const api = toReelDeliveryApiError(error);
    return NextResponse.json({ error: api.message }, { status: api.status });
  }
}
