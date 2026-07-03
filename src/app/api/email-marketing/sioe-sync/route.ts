import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireAdminUser } from "@/lib/api-auth";
import {
  isSioeSyncConfigured,
  syncSioeActiveClients,
  syncSioeResponsiblesOnly,
  testSioeConnection,
} from "@/lib/sioe-sync-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Testa conexão com o Supabase SIOE e conta clientes ativos. */
export async function GET() {
  try {
    await requireAuthenticatedUser();
    if (!isSioeSyncConfigured()) {
      return NextResponse.json({
        configured: false,
        ok: false,
        message: "Configure SIOE_SUPABASE_SERVICE_ROLE_KEY no .env.",
      });
    }
    const result = await testSioeConnection();
    return NextResponse.json({ configured: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao testar SIOE.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/** Sincroniza clientes ativos do SIOE (full) ou só responsáveis (?mode=responsibles). */
export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    await requireAdminUser(user.id);
    if (!isSioeSyncConfigured()) {
      return NextResponse.json(
        { error: "Configure SIOE_SUPABASE_SERVICE_ROLE_KEY no .env." },
        { status: 400 }
      );
    }

    const mode = new URL(request.url).searchParams.get("mode") ?? "full";
    if (mode === "responsibles") {
      const result = await syncSioeResponsiblesOnly();
      return NextResponse.json({ success: true, mode: "responsibles", ...result });
    }

    const result = await syncSioeActiveClients();
    return NextResponse.json({ success: true, mode: "full", ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao sincronizar SIOE.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
