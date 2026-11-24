import { NextResponse } from "next/server";
import { currentUser, markNotificationsRead } from "@/lib/notifications/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";

export const dynamic = "force-dynamic";

/** Marca avisos como lidos: `{ ids: [...] }` ou `{}` para todos. */
export async function POST(request: Request) {
  try {
    const { db, userId } = await currentUser();
    const body = (await request.json().catch(() => ({}))) as { ids?: unknown };
    const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === "string").slice(0, 200) : null;
    await markNotificationsRead(db, userId, ids);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
