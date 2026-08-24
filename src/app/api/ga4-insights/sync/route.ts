import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { runGa4Sync } from "@/lib/ga4-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    await requireAuthenticatedUser();
    const result = await runGa4Sync();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao sincronizar GA4.";
    const status = message.includes("Não autenticado") || message.includes("inativo") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
