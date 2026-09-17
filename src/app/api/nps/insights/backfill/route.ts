import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { fetchNpsResults, NpsHttpError } from "@/lib/nps/server";
import { backfillNpsCampaignInsights } from "@/lib/nps/insights-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    let campaignId: string | null = null;
    try {
      const body = (await request.json()) as { campaignId?: unknown };
      campaignId = typeof body.campaignId === "string" ? body.campaignId : null;
    } catch {
      campaignId = null;
    }

    const results = await fetchNpsResults({
      authUserId: user.id,
      campaignId,
    });

    const out = await backfillNpsCampaignInsights({ responses: results.responses });
    return NextResponse.json(out);
  } catch (err) {
    if (err instanceof NpsHttpError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Erro ao classificar comentários.";
    const status = message.includes("Não autenticado")
      ? 401
      : message.includes("Sem permissão")
        ? 403
        : 500;
    if (status !== 500) {
      return NextResponse.json({ error: message }, { status });
    }
    console.error("[nps-insights] backfill", err);
    return NextResponse.json({ classified: 0, pending: 0, error: message }, { status: 200 });
  }
}
