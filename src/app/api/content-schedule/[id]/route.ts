import { NextResponse } from "next/server";
import { toContentScheduleApiError, updateContentScheduleSlot, updateContentScheduleSlotSchema, type UpdateSlotInput } from "@/lib/content-schedule/server";

function failure(error: unknown) {
  const api = toContentScheduleApiError(error);
  return NextResponse.json({ error: api.message, code: api.code }, { status: api.status });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }
    const parsed = updateContentScheduleSlotSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Revise os dados da alteração." }, { status: 400 });
    return NextResponse.json({ slot: await updateContentScheduleSlot(id, parsed.data as UpdateSlotInput) });
  } catch (error) { return failure(error); }
}
