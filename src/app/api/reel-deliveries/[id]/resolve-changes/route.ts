import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveReelChangesSchema } from "@/lib/reel-deliveries/domain";
import { getReelDelivery, resolveReelChanges, toReelDeliveryApiError } from "@/lib/reel-deliveries/server";

export const dynamic = "force-dynamic";

/** Marketing marca os pedidos de ajuste da versão atual como feitos. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = z.string().uuid().safeParse((await context.params).id);
  if (!id.success) return NextResponse.json({ error: "Reel não encontrado." }, { status: 404 });
  const body = resolveReelChangesSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Dados inválidos para o ajuste." }, { status: 400 });
  try {
    await resolveReelChanges(id.data, body.data);
    return NextResponse.json({ delivery: await getReelDelivery(id.data) });
  } catch (error) {
    const api = toReelDeliveryApiError(error);
    return NextResponse.json({ error: api.message }, { status: api.status });
  }
}
