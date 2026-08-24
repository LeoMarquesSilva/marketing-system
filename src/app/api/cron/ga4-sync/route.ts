import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runGa4Sync } from "@/lib/ga4-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Cron diário — sincroniza métricas do site institucional (GA4).
 * Aceita `?days=N` (protegido pelo mesmo segredo do cron) pra rodar uma carga
 * histórica maior sob demanda, sem mudar a janela padrão da rotina automática.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const daysParam = url.searchParams.get("days");
  const days = daysParam ? Number(daysParam) : undefined;

  try {
    const result = await runGa4Sync(days && Number.isFinite(days) && days > 0 ? days : undefined);
    return NextResponse.json({ success: true, ...result, finishedAt: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao sincronizar GA4.";
    console.error("[cron/ga4-sync]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
