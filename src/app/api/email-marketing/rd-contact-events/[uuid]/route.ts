import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { fetchRdContactEvents, isRdMarketingConfigured } from "@/lib/rd-station-marketing-server";

export const dynamic = "force-dynamic";

/** Eventos do contato no RD Station (conversões, oportunidades). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    await requireAuthenticatedUser();
    const { uuid } = await params;
    if (!uuid?.trim()) {
      return NextResponse.json({ error: "UUID inválido." }, { status: 400 });
    }
    if (!isRdMarketingConfigured()) {
      return NextResponse.json({ error: "RD Station não configurado." }, { status: 400 });
    }
    const events = await fetchRdContactEvents(uuid);
    return NextResponse.json({ events });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao buscar eventos do RD.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
