import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createSlotFromPendingScheduleLink,
  resolvePendingScheduleLink,
  toContentScheduleApiError,
} from "@/lib/content-schedule/server";

const inputSchema = z.union([
  z.object({ slot_id: z.string().uuid() }).strict(),
  z.object({ create_slot: z.literal(true) }).strict(),
]);

function failure(error: unknown) {
  const api = toContentScheduleApiError(error);
  return NextResponse.json({ error: api.message, code: api.code }, { status: api.status });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Vaga inválida." }, { status: 400 });
    if ("create_slot" in parsed.data) {
      const slotId = await createSlotFromPendingScheduleLink(id);
      return NextResponse.json({ success: true, slotId, created: true });
    }
    await resolvePendingScheduleLink(id, parsed.data.slot_id);
    return NextResponse.json({ success: true, slotId: parsed.data.slot_id, created: false });
  } catch (error) { return failure(error); }
}
