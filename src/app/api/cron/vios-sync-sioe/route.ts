import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { reconcileViosScheduleYear } from "@/lib/content-schedule/server";
import { syncViosTasksFromSioe } from "@/lib/vios-sioe-sync-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Cron diário — reconcilia tarefas de Marketing do SIOE Pro no ORQESTRAI. */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const result = await syncViosTasksFromSioe();
    const scheduleLinks = await reconcileViosScheduleYear(result.year);
    return NextResponse.json({
      success: true,
      ...result,
      scheduleLinks,
      finishedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro ao sincronizar tarefas VIOS pelo SIOE.";
    console.error("[cron/vios-sync-sioe]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
