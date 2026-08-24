import "server-only";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";

function getServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isMissingGa4Schema(error: { code?: string; message?: string } | null): boolean {
  return Boolean(
    error &&
      (error.code === "42P01" ||
        error.code === "PGRST205" ||
        error.message?.includes("ga4_") ||
        error.message?.includes("schema cache"))
  );
}

export interface Ga4DailyMetricRow {
  metric_date: string;
  sessions: number;
  active_users: number;
  new_users: number;
  screen_page_views: number;
  engaged_sessions: number;
  user_engagement_duration_seconds: number;
  event_count: number;
  conversions: number;
  whatsapp_clicks: number;
}

export interface Ga4ChannelMetricRow {
  metric_date: string;
  channel_group: string;
  sessions: number;
}

export interface Ga4PageMetricRow {
  metric_date: string;
  page_path: string;
  page_title: string | null;
  sessions: number;
  screen_page_views: number;
}

export interface Ga4LocationMetricRow {
  metric_date: string;
  city: string;
  country: string;
  sessions: number;
  active_users: number;
}

export interface Ga4DeviceMetricRow {
  metric_date: string;
  device_category: string;
  sessions: number;
}

export interface Ga4LandingPageMetricRow {
  metric_date: string;
  landing_page: string;
  sessions: number;
  conversions: number;
}

export interface Ga4KeyEventMetricRow {
  metric_date: string;
  event_name: string;
  event_count: number;
}

export interface Ga4ImportRow {
  id: string;
  status: string;
  daily_rows: number;
  channel_rows: number;
  page_rows: number;
  date_from: string | null;
  date_to: string | null;
  error: string | null;
  imported_at: string;
}

export interface Ga4DashboardData {
  dailyMetrics: Ga4DailyMetricRow[];
  channelMetrics: Ga4ChannelMetricRow[];
  pageMetrics: Ga4PageMetricRow[];
  locationMetrics: Ga4LocationMetricRow[];
  deviceMetrics: Ga4DeviceMetricRow[];
  landingPageMetrics: Ga4LandingPageMetricRow[];
  keyEventMetrics: Ga4KeyEventMetricRow[];
  lastImport: Ga4ImportRow | null;
  unavailableReason: string | null;
}

const EMPTY_DATA: Ga4DashboardData = {
  dailyMetrics: [],
  channelMetrics: [],
  pageMetrics: [],
  locationMetrics: [],
  deviceMetrics: [],
  landingPageMetrics: [],
  keyEventMetrics: [],
  lastImport: null,
  unavailableReason: null,
};

export async function fetchGa4DashboardData(): Promise<Ga4DashboardData> {
  const supabase = getServiceClient();
  const [
    dailyResult,
    channelResult,
    pagesResult,
    locationsResult,
    devicesResult,
    landingResult,
    keyEventsResult,
    importsResult,
  ] = await Promise.all([
    supabase.from("ga4_daily_metrics").select("*").order("metric_date", { ascending: true }),
    supabase.from("ga4_channel_daily_metrics").select("*").order("metric_date", { ascending: true }),
    supabase.from("ga4_page_daily_metrics").select("*").order("metric_date", { ascending: true }),
    supabase.from("ga4_location_daily_metrics").select("*").order("metric_date", { ascending: true }),
    supabase.from("ga4_device_daily_metrics").select("*").order("metric_date", { ascending: true }),
    supabase.from("ga4_landing_page_daily_metrics").select("*").order("metric_date", { ascending: true }),
    supabase.from("ga4_key_event_daily_metrics").select("*").order("metric_date", { ascending: true }),
    supabase.from("ga4_imports").select("*").order("imported_at", { ascending: false }).limit(1),
  ]);

  const firstError =
    dailyResult.error ??
    channelResult.error ??
    pagesResult.error ??
    locationsResult.error ??
    devicesResult.error ??
    landingResult.error ??
    keyEventsResult.error ??
    importsResult.error;
  if (firstError) {
    if (isMissingGa4Schema(firstError)) {
      return { ...EMPTY_DATA, unavailableReason: "A migration do GA4 Insights ainda não foi aplicada no Supabase." };
    }
    throw new Error(firstError.message);
  }

  return {
    dailyMetrics: (dailyResult.data ?? []) as Ga4DailyMetricRow[],
    channelMetrics: (channelResult.data ?? []) as Ga4ChannelMetricRow[],
    pageMetrics: (pagesResult.data ?? []) as Ga4PageMetricRow[],
    locationMetrics: (locationsResult.data ?? []) as Ga4LocationMetricRow[],
    deviceMetrics: (devicesResult.data ?? []) as Ga4DeviceMetricRow[],
    landingPageMetrics: (landingResult.data ?? []) as Ga4LandingPageMetricRow[],
    keyEventMetrics: (keyEventsResult.data ?? []) as Ga4KeyEventMetricRow[],
    lastImport: ((importsResult.data ?? [])[0] as Ga4ImportRow | undefined) ?? null,
    unavailableReason: null,
  };
}
