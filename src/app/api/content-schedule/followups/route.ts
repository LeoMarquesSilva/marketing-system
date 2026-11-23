import { NextResponse } from "next/server";
import {
  createContentScheduleFollowup,
  createFollowupSchema,
  deleteContentScheduleFollowup,
  getContentScheduleFollowups,
} from "@/lib/content-schedule/followups-server";
import { toContentScheduleApiError } from "@/lib/content-schedule/server";

export const dynamic = "force-dynamic";

function failure(error: unknown) {
  const api = toContentScheduleApiError(error);
  return NextResponse.json({ error: api.message, code: api.code }, { status: api.status });
}

export async function GET(request: Request) {
  try {
    const month = new URL(request.url).searchParams.get("month") ?? undefined;
    return NextResponse.json(await getContentScheduleFollowups(month));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const parsed = createFollowupSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Revise os dados da cobrança." }, { status: 400 });
    return NextResponse.json(await createContentScheduleFollowup(parsed.data), { status: 201 });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await deleteContentScheduleFollowup(new URL(request.url).searchParams.get("id") ?? "");
    return NextResponse.json({ success: true });
  } catch (error) {
    return failure(error);
  }
}
