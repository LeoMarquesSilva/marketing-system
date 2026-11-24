import { NextResponse } from "next/server";
import { FEEDBACK_HR_ONLY } from "@/lib/access-control";
import { currentUser, listNotifications, unreadCount } from "@/lib/notifications/server";
import { hasHrAccess } from "@/lib/rh/access";
import { ensureCoverageReminder } from "@/lib/rh/feedback/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";

export const dynamic = "force-dynamic";

/**
 * Sino geral. `?lista=1` traz os avisos (ao abrir o sino); sem ele, só a contagem
 * (usada no ícone). Enquanto o feedback estiver em teste, o sino só existe para RH e admin.
 */
export async function GET(request: Request) {
  try {
    const { db, userId } = await currentUser();
    if (FEEDBACK_HR_ONLY) {
      const { data } = await db.from("users").select("role, permissions").eq("id", userId).maybeSingle();
      if (!hasHrAccess(data?.role as string | null, data?.permissions as string[] | null)) {
        return NextResponse.json({ enabled: false, unread: 0, items: [] });
      }
    }
    const wantsList = new URL(request.url).searchParams.get("lista") === "1";
    if (wantsList) {
      await ensureCoverageReminder(db, userId).catch((error) => console.error("[avisos] lembrete:", error));
      const [items, unread] = await Promise.all([listNotifications(db, userId), unreadCount(db, userId)]);
      return NextResponse.json({ enabled: true, unread, items });
    }
    return NextResponse.json({ enabled: true, unread: await unreadCount(db, userId) });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
