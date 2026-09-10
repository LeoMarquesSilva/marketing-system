import { NextResponse } from "next/server";
import {
  assigneeReviewYearSchema,
  associateContentScheduleAssignee,
  associateContentScheduleAssigneeSchema,
  getContentScheduleAssigneeReview,
  toContentScheduleApiError,
} from "@/lib/content-schedule/server";

export const dynamic = "force-dynamic";

function failure(error: unknown) {
  const api = toContentScheduleApiError(error);
  return NextResponse.json({ error: api.message, code: api.code }, { status: api.status });
}

export async function GET(request: Request) {
  try {
    const rawYear = new URL(request.url).searchParams.get("year") ?? new Date().getFullYear();
    const parsed = assigneeReviewYearSchema.safeParse(rawYear);
    if (!parsed.success) return NextResponse.json({ error: "Ano inválido." }, { status: 400 });
    return NextResponse.json(await getContentScheduleAssigneeReview(parsed.data));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = associateContentScheduleAssigneeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Revise a associação do responsável." }, { status: 400 });
    }
    return NextResponse.json(await associateContentScheduleAssignee(parsed.data));
  } catch (error) {
    return failure(error);
  }
}
