import { NextResponse } from "next/server";
import { z } from "zod";
import { updateReelDeliverySchema } from "@/lib/reel-deliveries/domain";
import {
  deleteReelDelivery,
  getReelDelivery,
  toReelDeliveryApiError,
  updateReelDelivery,
} from "@/lib/reel-deliveries/server";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

async function parseId(context: Context) {
  const { id } = await context.params;
  return z.string().uuid().safeParse(id);
}

export async function GET(_request: Request, context: Context) {
  const id = await parseId(context);
  if (!id.success) return NextResponse.json({ error: "Reel não encontrado." }, { status: 404 });
  try {
    return NextResponse.json({ delivery: await getReelDelivery(id.data) });
  } catch (error) {
    const api = toReelDeliveryApiError(error);
    return NextResponse.json({ error: api.message }, { status: api.status });
  }
}

export async function PATCH(request: Request, context: Context) {
  const id = await parseId(context);
  if (!id.success) return NextResponse.json({ error: "Reel não encontrado." }, { status: 404 });
  const parsed = updateReelDeliverySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos para o reel." }, { status: 400 });
  try {
    await updateReelDelivery(id.data, parsed.data);
    return NextResponse.json({ delivery: await getReelDelivery(id.data) });
  } catch (error) {
    const api = toReelDeliveryApiError(error);
    return NextResponse.json({ error: api.message }, { status: api.status });
  }
}

export async function DELETE(_request: Request, context: Context) {
  const id = await parseId(context);
  if (!id.success) return NextResponse.json({ error: "Reel não encontrado." }, { status: 404 });
  try {
    await deleteReelDelivery(id.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const api = toReelDeliveryApiError(error);
    return NextResponse.json({ error: api.message }, { status: api.status });
  }
}
