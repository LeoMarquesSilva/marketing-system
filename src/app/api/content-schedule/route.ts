import { NextResponse } from "next/server";
import {
  createContentScheduleSlots,
  createContentScheduleSlotSchema,
  getContentSchedule,
  toContentScheduleApiError,
  type CreateSlotInput,
} from "@/lib/content-schedule/server";

export const dynamic = "force-dynamic";

function failure(error: unknown) {
  const api = toContentScheduleApiError(error);
  return NextResponse.json({ error: api.message, code: api.code }, { status: api.status });
}

export async function GET(request: Request) {
  try {
    const month = new URL(request.url).searchParams.get("month") ?? undefined;
    return NextResponse.json(await getContentSchedule(month));
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const rawInputs = Array.isArray(body?.slots) ? body.slots : body ? [body] : [];
    const parsed = createContentScheduleSlotSchema.array().min(1).max(200).safeParse(rawInputs);
    if (!parsed.success) return NextResponse.json({ error: "Revise os dados das vagas." }, { status: 400 });
    const slots = await createContentScheduleSlots(parsed.data as CreateSlotInput[]);
    return NextResponse.json({ slots }, { status: 201 });
  } catch (error) { return failure(error); }
}
