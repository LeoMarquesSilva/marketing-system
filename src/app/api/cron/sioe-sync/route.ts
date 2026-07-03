import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import {
  isSioeSyncConfigured,
  syncSioeActiveClients,
  syncSioeResponsiblesOnly,
} from "@/lib/sioe-sync-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Cron — sync SIOE (responsibles diário; full semanal via ?mode=full). */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (!isSioeSyncConfigured()) {
    return NextResponse.json({ error: "SIOE não configurado." }, { status: 400 });
  }

  const mode = new URL(request.url).searchParams.get("mode") ?? "responsibles";

  try {
    if (mode === "full") {
      const result = await syncSioeActiveClients();
      return NextResponse.json({ success: true, mode: "full", ...result, finishedAt: new Date().toISOString() });
    }

    const result = await syncSioeResponsiblesOnly();
    return NextResponse.json({
      success: true,
      mode: "responsibles",
      ...result,
      finishedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro no sync SIOE.";
    console.error("[cron/sioe-sync]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
