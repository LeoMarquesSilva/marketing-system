import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { isOpexSyncConfigured, syncOpexSupplierPayments } from "@/lib/facilities/opex-sync-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Cron diário — pagamentos a fornecedores do OPEX (SIOE) para Facilities > Fornecedores e prestadores. */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!isOpexSyncConfigured()) {
    return NextResponse.json({ error: "SIOE não configurado." }, { status: 400 });
  }
  try {
    const result = await syncOpexSupplierPayments("cron");
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao atualizar o OPEX.";
    console.error("[cron/opex-fornecedores-sync]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
