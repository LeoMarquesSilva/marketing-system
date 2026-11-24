import { Suspense } from "react";
import { createClient } from "@supabase/supabase-js";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Ga4InsightsClient, type Ga4ScreenData } from "@/components/ga4/ga4-insights-client";
import { fetchAllPages } from "@/lib/supabase-pages";
import { fetchGa4Freshness } from "@/lib/social-metrics/server";
import { addDays, parseMetricsPeriod, resolveMetricsPeriod } from "@/lib/social-metrics/period";
import type { SourceFreshness } from "@/lib/social-metrics/freshness";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Colunas de cada tabela do GA4. As tabelas por página, cidade e página de
 * entrada passam de 1.000 linhas (o máximo que o Supabase devolve por vez),
 * então a leitura é paginada e só do intervalo que a tela usa.
 */
const GA4_TABLES = {
  dailyMetrics: {
    table: "ga4_daily_metrics",
    columns:
      "metric_date, sessions, active_users, new_users, screen_page_views, engaged_sessions, user_engagement_duration_seconds, event_count, conversions, whatsapp_clicks",
  },
  channelMetrics: { table: "ga4_channel_daily_metrics", columns: "metric_date, channel_group, sessions" },
  pageMetrics: { table: "ga4_page_daily_metrics", columns: "metric_date, page_path, page_title, sessions, screen_page_views" },
  locationMetrics: { table: "ga4_location_daily_metrics", columns: "metric_date, city, country, sessions, active_users" },
  deviceMetrics: { table: "ga4_device_daily_metrics", columns: "metric_date, device_category, sessions" },
  landingPageMetrics: { table: "ga4_landing_page_daily_metrics", columns: "metric_date, landing_page, sessions, conversions" },
  keyEventMetrics: { table: "ga4_key_event_daily_metrics", columns: "metric_date, event_name, event_count" },
} as const satisfies Record<keyof Ga4ScreenData, { table: string; columns: string }>;

function serviceDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Linhas do GA4 entre as datas (inclusive), na ordem do dia. */
async function fetchGa4Range(from: string, to: string): Promise<Ga4ScreenData> {
  const db = serviceDb();
  const read = <K extends keyof Ga4ScreenData>(key: K) => {
    const { table, columns } = GA4_TABLES[key];
    return fetchAllPages<Ga4ScreenData[K][number]>(
      (start, end) =>
        db
          .from(table)
          .select(columns)
          .gte("metric_date", from)
          .lte("metric_date", to)
          .order("metric_date", { ascending: true })
          .order("id", { ascending: true })
          .range(start, end) as unknown as PromiseLike<{ data: Ga4ScreenData[K][number][] | null; error: { message: string } | null }>
    ) as Promise<Ga4ScreenData[K]>;
  };
  const [dailyMetrics, channelMetrics, pageMetrics, locationMetrics, deviceMetrics, landingPageMetrics, keyEventMetrics] = await Promise.all([
    read("dailyMetrics"),
    read("channelMetrics"),
    read("pageMetrics"),
    read("locationMetrics"),
    read("deviceMetrics"),
    read("landingPageMetrics"),
    read("keyEventMetrics"),
  ]);
  return { dailyMetrics, channelMetrics, pageMetrics, locationMetrics, deviceMetrics, landingPageMetrics, keyEventMetrics };
}

function unavailableMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("ga4_") || message.includes("schema cache") || message.includes("does not exist")) {
    return "As tabelas do Google Analytics ainda não existem no Supabase.";
  }
  return message || "Não foi possível carregar as métricas do site.";
}

/**
 * Métricas do Site (GA4). Lê do banco só o período escolhido e o de
 * comparação (?periodo=…&comparar=…); a coleta no GA4 é do cron diário ou do
 * botão "Atualizar agora".
 */
export default async function Ga4InsightsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const raw = await searchParams;
  const params: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(raw)) params[key] = Array.isArray(value) ? value[0] : value;
  const period = resolveMetricsPeriod(parseMetricsPeriod(params));
  // Um dia de folga nas pontas: o navegador resolve o período com o próprio relógio.
  const loadFrom = addDays(period.compareFrom < period.from ? period.compareFrom : period.from, -1);
  const loadTo = addDays(period.to > period.compareTo ? period.to : period.compareTo, 1);

  let data: Ga4ScreenData | null = null;
  let error: string | null = null;
  let freshness: SourceFreshness | null = null;
  const [dataResult, freshnessResult] = await Promise.allSettled([fetchGa4Range(loadFrom, loadTo), fetchGa4Freshness()]);
  if (dataResult.status === "fulfilled") data = dataResult.value;
  else error = unavailableMessage(dataResult.reason);
  if (freshnessResult.status === "fulfilled") freshness = freshnessResult.value;

  if (!data) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-900">
        Não foi possível carregar as métricas do site: {error}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Suspense>
        <Ga4InsightsClient data={data} freshness={freshness} />
      </Suspense>
    </TooltipProvider>
  );
}
