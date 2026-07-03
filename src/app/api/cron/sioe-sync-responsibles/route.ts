import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { isSioeSyncConfigured, syncSioeResponsiblesOnly } from "@/lib/sioe-sync-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Cron diário — atualiza responsáveis/áreas a partir do SIOE PRO. */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!isSioeSyncConfigured()) {
    return NextResponse.json({ error: "SIOE não configurado." }, { status: 400 });
  }

  try {
    const result = await syncSioeResponsiblesOnly();
    return NextResponse.json({
      success: true,
      mode: "responsibles",
      ...result,
      finishedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro no sync SIOE.";
    console.error("[cron/sioe-sync-responsibles]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
