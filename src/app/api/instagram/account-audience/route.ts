import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchLatestAccountStats } from "@/lib/instagram-posts";
import { fetchAccountInsightsHistory } from "@/lib/instagram-account-insights";
import { fetchAudienceDemographics } from "@/lib/instagram-demographics";

export const dynamic = "force-dynamic";

/** Números da conta + demografia gravados no banco (a coleta na Meta é do cron). */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const [insights, demographics, accountStats] = await Promise.all([
      fetchAccountInsightsHistory(),
      fetchAudienceDemographics(),
      fetchLatestAccountStats(),
    ]);

    return NextResponse.json({ success: true, insights, demographics, accountStats });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao carregar audiência.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
