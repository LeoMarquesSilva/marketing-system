import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { listEmailDomains, isEmailMarketingConfigured } from "@/lib/email-marketing-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAuthenticatedUser();
    if (!isEmailMarketingConfigured()) {
      return NextResponse.json({ configured: false, domains: [] });
    }
    const domains = await listEmailDomains();
    return NextResponse.json({ configured: true, domains });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao consultar domínios.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
