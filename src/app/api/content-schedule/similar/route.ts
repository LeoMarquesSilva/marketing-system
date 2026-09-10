import { NextResponse } from "next/server";
import { getContentSimilarity, toContentScheduleApiError } from "@/lib/content-schedule/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const contentId = new URL(request.url).searchParams.get("contentId");
    if (!contentId) return NextResponse.json({ error: "Conteúdo não informado." }, { status: 400 });
    return NextResponse.json({ warnings: await getContentSimilarity(contentId) });
  } catch (error) {
    const api = toContentScheduleApiError(error);
    return NextResponse.json({ error: api.message, code: api.code }, { status: api.status });
  }
}
