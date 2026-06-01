import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { syncAccountExtras } from "@/lib/instagram-meta";
import { fetchLatestAccountStats, upsertAccountStats } from "@/lib/instagram-posts";
import { fetchAccountInsightsHistory, upsertAccountInsights } from "@/lib/instagram-account-insights";
import { fetchAudienceDemographics, replaceAudienceDemographics } from "@/lib/instagram-demographics";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Retorna insights de conta + demografia persistidos. ?refresh=1 coleta da API Meta. */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const refresh = new URL(request.url).searchParams.get("refresh") === "1";
    let syncWarning: string | null = null;

    if (refresh) {
      try {
        const extras = await syncAccountExtras();
        await upsertAccountStats(extras.account);
        await Promise.all([
          upsertAccountInsights(extras.insights),
          replaceAudienceDemographics(extras.demographics),
        ]);
      } catch (err) {
        syncWarning = err instanceof Error ? err.message : "Falha ao atualizar da API Meta.";
      }
    }

    const [insights, demographics, accountStats] = await Promise.all([
      fetchAccountInsightsHistory(),
      fetchAudienceDemographics(),
      fetchLatestAccountStats(),
    ]);

    return NextResponse.json({
      success: true,
      syncWarning,
      insights,
      demographics,
      accountStats,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao carregar audiência.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
