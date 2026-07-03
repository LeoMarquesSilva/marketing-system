import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { getEmailSenderConfig } from "@/lib/email-marketing-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAuthenticatedUser();
    return NextResponse.json(getEmailSenderConfig());
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao consultar remetente.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
