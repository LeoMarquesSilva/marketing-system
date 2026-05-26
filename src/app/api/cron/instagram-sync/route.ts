import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runFullInstagramSync } from "@/lib/instagram-sync-job";
import { SYNC_SINCE_DEFAULT } from "@/lib/instagram-meta";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Cron diário — sincroniza posts e métricas do Instagram desde 2025. */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const result = await runFullInstagramSync(SYNC_SINCE_DEFAULT);
    return NextResponse.json({
      success: true,
      ...result,
      finishedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao sincronizar Instagram.";
    console.error("[cron/instagram-sync]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
