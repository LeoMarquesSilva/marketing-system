import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import {
  isRdMarketingConfigured,
  syncRdMarketingContacts,
  testRdMarketingConnection,
} from "@/lib/rd-station-marketing-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Testa conexão OAuth com o RD Station Marketing. */
export async function GET() {
  try {
    await requireAuthenticatedUser();
    if (!isRdMarketingConfigured()) {
      return NextResponse.json({ configured: false, ok: false, message: "Credenciais RD não configuradas." });
    }
    const result = await testRdMarketingConnection();
    return NextResponse.json({ configured: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao testar RD Station.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/** Sincroniza contatos do RD Station Marketing para email_contacts. */
export async function POST(request: Request) {
  try {
    await requireAuthenticatedUser();
    if (!isRdMarketingConfigured()) {
      return NextResponse.json({ error: "Credenciais RD não configuradas no .env." }, { status: 400 });
    }
    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "true";
    const result = await syncRdMarketingContacts({ force });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao sincronizar RD Station.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
