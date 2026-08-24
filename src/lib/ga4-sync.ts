import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { inListDimensionFilter, parseGa4Date, runGa4Report } from "@/lib/ga4-client";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";

function getServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Sincronização diária (cron): só precisa cobrir o atraso normal de
 * processamento do GA4 nos últimos dias — não o histórico inteiro.
 */
const DEFAULT_WINDOW_DAYS = 10;
const TOP_PAGES_DISCOVERY_LIMIT = 25;
const TOP_LOCATIONS_DISCOVERY_LIMIT = 20;
const TOP_LANDING_PAGES_DISCOVERY_LIMIT = 20;
/** Eventos-chave configurados na propriedade que representam lead real (não o "purchase" padrão de e-commerce, não usado aqui). */
const KEY_EVENT_NAMES = ["form_submit", "ads_conversion_Fale_conosco_1"];
/** Limite de linhas por chamada de upsert, pra não estourar o tamanho da requisição num backfill grande. */
const UPSERT_BATCH_SIZE = 800;

function dateNDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

async function upsertInBatches<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  rows: T[],
  onConflict: string
): Promise<void> {
  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    const chunk = rows.slice(i, i + UPSERT_BATCH_SIZE);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

export interface Ga4SyncResult {
  importId: string;
  dailyRows: number;
  channelRows: number;
  pageRows: number;
  locationRows: number;
  deviceRows: number;
  landingPageRows: number;
  keyEventRows: number;
  dateFrom: string;
  dateTo: string;
}

/**
 * @param windowDays Quantos dias pra trás sincronizar. Padrão cobre o cron
 * diário; para carregar o histórico completo (ex.: desde a criação da
 * propriedade GA4), chame com um valor maior — é seguro rodar de novo, tudo
 * é upsert.
 */
export async function runGa4Sync(windowDays: number = DEFAULT_WINDOW_DAYS): Promise<Ga4SyncResult> {
  const supabase = getServiceClient();
  const dateFrom = dateNDaysAgo(windowDays);
  const dateTo = dateNDaysAgo(0);
  const range = [{ startDate: dateFrom, endDate: dateTo }];

  const { data: importRow, error: importError } = await supabase
    .from("ga4_imports")
    .insert({ status: "processing", date_from: dateFrom, date_to: dateTo })
    .select("id")
    .single();
  if (importError) throw new Error(importError.message);
  const importId = importRow.id as string;

  try {
    const [dailyReport, channelReport, devicesReport, pagesDiscovery, locationsDiscovery, landingDiscovery, whatsappReport] =
      await Promise.all([
        runGa4Report({
          dateRanges: range,
          dimensions: [{ name: "date" }],
          metrics: [
            { name: "sessions" },
            { name: "activeUsers" },
            { name: "newUsers" },
            { name: "screenPageViews" },
            { name: "engagedSessions" },
            { name: "userEngagementDuration" },
            { name: "eventCount" },
            { name: "conversions" },
          ],
        }),
        runGa4Report({
          dateRanges: range,
          dimensions: [{ name: "date" }, { name: "sessionDefaultChannelGroup" }],
          metrics: [{ name: "sessions" }],
        }),
        runGa4Report({
          dateRanges: range,
          dimensions: [{ name: "date" }, { name: "deviceCategory" }],
          metrics: [{ name: "sessions" }],
        }),
        runGa4Report({
          dateRanges: range,
          dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
          metrics: [{ name: "screenPageViews" }],
          orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
          limit: TOP_PAGES_DISCOVERY_LIMIT,
        }),
        runGa4Report({
          dateRanges: range,
          dimensions: [{ name: "city" }, { name: "country" }],
          metrics: [{ name: "sessions" }],
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          limit: TOP_LOCATIONS_DISCOVERY_LIMIT,
        }),
        runGa4Report({
          dateRanges: range,
          dimensions: [{ name: "landingPagePlusQueryString" }],
          metrics: [{ name: "sessions" }],
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          limit: TOP_LANDING_PAGES_DISCOVERY_LIMIT,
        }),
        // Cliques no botão do WhatsApp: já capturados pelo Enhanced Measurement
        // do GA4 (clique em link externo), não precisa de tag nova no site.
        runGa4Report({
          dateRanges: range,
          dimensions: [{ name: "date" }],
          metrics: [{ name: "eventCount" }],
          dimensionFilter: { filter: { fieldName: "linkDomain", stringFilter: { value: "wa.me" } } },
        }),
      ]);

    const now = new Date().toISOString();

    // --- métricas diárias gerais (inclui conversões) ---
    const whatsappByDate = new Map<string, number>();
    for (const row of whatsappReport.rows) {
      const [date] = row.dimensionValues;
      const [eventCount] = row.metricValues;
      whatsappByDate.set(parseGa4Date(date), eventCount);
    }

    const dailyRows = dailyReport.rows.map((row) => {
      const [date] = row.dimensionValues;
      const [
        sessions,
        activeUsers,
        newUsers,
        screenPageViews,
        engagedSessions,
        engagementDuration,
        eventCount,
        conversions,
      ] = row.metricValues;
      const metricDate = parseGa4Date(date);
      return {
        metric_date: metricDate,
        sessions,
        active_users: activeUsers,
        new_users: newUsers,
        screen_page_views: screenPageViews,
        engaged_sessions: engagedSessions,
        user_engagement_duration_seconds: engagementDuration,
        event_count: eventCount,
        conversions: Math.round(conversions),
        whatsapp_clicks: whatsappByDate.get(metricDate) ?? 0,
        source_import_id: importId,
        updated_at: now,
      };
    });
    if (dailyRows.length > 0) {
      await upsertInBatches(supabase, "ga4_daily_metrics", dailyRows, "metric_date");
    }

    // --- canais de aquisição, por dia ---
    const channelRows = channelReport.rows.map((row) => {
      const [date, channelGroup] = row.dimensionValues;
      const [sessions] = row.metricValues;
      return {
        metric_date: parseGa4Date(date),
        channel_group: channelGroup || "(não definido)",
        sessions,
        source_import_id: importId,
        updated_at: now,
      };
    });
    if (channelRows.length > 0) {
      await upsertInBatches(supabase, "ga4_channel_daily_metrics", channelRows, "metric_date,channel_group");
    }

    // --- dispositivo, por dia ---
    const deviceRows = devicesReport.rows.map((row) => {
      const [date, deviceCategory] = row.dimensionValues;
      const [sessions] = row.metricValues;
      return {
        metric_date: parseGa4Date(date),
        device_category: deviceCategory || "(não definido)",
        sessions,
        source_import_id: importId,
        updated_at: now,
      };
    });
    if (deviceRows.length > 0) {
      await upsertInBatches(supabase, "ga4_device_daily_metrics", deviceRows, "metric_date,device_category");
    }

    // --- páginas: descobre as relevantes no período e detalha dia a dia ---
    const pagePaths = Array.from(new Set(pagesDiscovery.rows.map((row) => row.dimensionValues[0])));
    const pageTitleByPath = new Map<string, string>();
    for (const row of pagesDiscovery.rows) {
      const [path, title] = row.dimensionValues;
      if (title && !pageTitleByPath.has(path)) pageTitleByPath.set(path, title);
    }

    let dedupedPageRows: Array<Record<string, unknown>> = [];
    if (pagePaths.length > 0) {
      const pagesDaily = await runGa4Report({
        dateRanges: range,
        dimensions: [{ name: "date" }, { name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }, { name: "sessions" }],
        dimensionFilter: inListDimensionFilter("pagePath", pagePaths),
        limit: pagePaths.length * (windowDays + 1),
      });
      const pageRows = pagesDaily.rows.map((row) => {
        const [date, pagePath] = row.dimensionValues;
        const [screenPageViews, sessions] = row.metricValues;
        return {
          metric_date: parseGa4Date(date),
          page_path: pagePath,
          page_title: pageTitleByPath.get(pagePath) ?? null,
          sessions,
          screen_page_views: screenPageViews,
          source_import_id: importId,
          updated_at: now,
        };
      });
      dedupedPageRows = Array.from(
        pageRows.reduce((map, row) => map.set(`${row.metric_date}__${row.page_path}`, row), new Map()).values()
      );
      if (dedupedPageRows.length > 0) {
        await upsertInBatches(supabase, "ga4_page_daily_metrics", dedupedPageRows, "metric_date,page_path");
      }
    }

    // --- localização: descobre as cidades relevantes e detalha dia a dia ---
    const cityNames = Array.from(new Set(locationsDiscovery.rows.map((row) => row.dimensionValues[0])));
    let dedupedLocationRows: Array<Record<string, unknown>> = [];
    if (cityNames.length > 0) {
      const locationsDaily = await runGa4Report({
        dateRanges: range,
        dimensions: [{ name: "date" }, { name: "city" }, { name: "country" }],
        metrics: [{ name: "sessions" }, { name: "activeUsers" }],
        dimensionFilter: inListDimensionFilter("city", cityNames),
        limit: cityNames.length * (windowDays + 1) * 2,
      });
      const locationRows = locationsDaily.rows.map((row) => {
        const [date, city, country] = row.dimensionValues;
        const [sessions, activeUsers] = row.metricValues;
        return {
          metric_date: parseGa4Date(date),
          city: city || "(não definido)",
          country: country || "(não definido)",
          sessions,
          active_users: activeUsers,
          source_import_id: importId,
          updated_at: now,
        };
      });
      const merged = new Map<string, (typeof locationRows)[number]>();
      for (const row of locationRows) {
        const key = `${row.metric_date}__${row.city}__${row.country}`;
        const existing = merged.get(key);
        if (existing) {
          existing.sessions += row.sessions;
          existing.active_users += row.active_users;
        } else {
          merged.set(key, { ...row });
        }
      }
      dedupedLocationRows = Array.from(merged.values());
      if (dedupedLocationRows.length > 0) {
        await upsertInBatches(supabase, "ga4_location_daily_metrics", dedupedLocationRows, "metric_date,city,country");
      }
    }

    // --- páginas de entrada + conversões, dia a dia (o que de fato gera lead) ---
    const landingPaths = Array.from(new Set(landingDiscovery.rows.map((row) => row.dimensionValues[0])));
    let dedupedLandingRows: Array<Record<string, unknown>> = [];
    if (landingPaths.length > 0) {
      const landingDaily = await runGa4Report({
        dateRanges: range,
        dimensions: [{ name: "date" }, { name: "landingPagePlusQueryString" }],
        metrics: [{ name: "sessions" }, { name: "conversions" }],
        dimensionFilter: inListDimensionFilter("landingPagePlusQueryString", landingPaths),
        limit: landingPaths.length * (windowDays + 1),
      });
      const landingRows = landingDaily.rows.map((row) => {
        const [date, landingPage] = row.dimensionValues;
        const [sessions, conversions] = row.metricValues;
        return {
          metric_date: parseGa4Date(date),
          landing_page: landingPage,
          sessions,
          conversions: Math.round(conversions),
          source_import_id: importId,
          updated_at: now,
        };
      });
      dedupedLandingRows = Array.from(
        landingRows.reduce((map, row) => map.set(`${row.metric_date}__${row.landing_page}`, row), new Map()).values()
      );
      if (dedupedLandingRows.length > 0) {
        await upsertInBatches(supabase, "ga4_landing_page_daily_metrics", dedupedLandingRows, "metric_date,landing_page");
      }
    }

    // --- eventos-chave (conversões) por tipo, dia a dia ---
    const keyEventsReport = await runGa4Report({
      dateRanges: range,
      dimensions: [{ name: "date" }, { name: "eventName" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: inListDimensionFilter("eventName", KEY_EVENT_NAMES),
      limit: KEY_EVENT_NAMES.length * (windowDays + 1),
    });
    const keyEventRows = keyEventsReport.rows.map((row) => {
      const [date, eventName] = row.dimensionValues;
      const [eventCount] = row.metricValues;
      return {
        metric_date: parseGa4Date(date),
        event_name: eventName,
        event_count: eventCount,
        source_import_id: importId,
        updated_at: now,
      };
    });
    if (keyEventRows.length > 0) {
      await upsertInBatches(supabase, "ga4_key_event_daily_metrics", keyEventRows, "metric_date,event_name");
    }

    const { error: completedError } = await supabase
      .from("ga4_imports")
      .update({
        status: "completed",
        daily_rows: dailyRows.length,
        channel_rows: channelRows.length,
        page_rows: dedupedPageRows.length,
      })
      .eq("id", importId);
    if (completedError) throw new Error(completedError.message);

    return {
      importId,
      dailyRows: dailyRows.length,
      channelRows: channelRows.length,
      pageRows: dedupedPageRows.length,
      locationRows: dedupedLocationRows.length,
      deviceRows: deviceRows.length,
      landingPageRows: dedupedLandingRows.length,
      keyEventRows: keyEventRows.length,
      dateFrom,
      dateTo,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    await supabase.from("ga4_imports").update({ status: "failed", error: message }).eq("id", importId);
    throw error;
  }
}
