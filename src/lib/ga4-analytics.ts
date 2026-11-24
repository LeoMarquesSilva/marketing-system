import type {
  Ga4ChannelMetricRow,
  Ga4DailyMetricRow,
  Ga4DeviceMetricRow,
  Ga4KeyEventMetricRow,
  Ga4LandingPageMetricRow,
  Ga4LocationMetricRow,
  Ga4PageMetricRow,
} from "@/lib/ga4-server";
import { eachDate, isDateInRange } from "@/lib/social-metrics/period";

/** Períodos de análise disponíveis no painel. */
export const GA4_DATE_RANGES = [
  { value: 7, label: "7 dias" },
  { value: 30, label: "30 dias" },
  { value: 90, label: "90 dias" },
  { value: 180, label: "6 meses" },
  { value: 365, label: "12 meses" },
] as const;
export type Ga4DateRangeDays = (typeof GA4_DATE_RANGES)[number]["value"];

/** Últimos N dias e os N anteriores a eles (pra calcular variação %). */
export function splitLastNDays<T extends { metric_date: string }>(
  rows: T[],
  n: number
): { current: T[]; previous: T[] } {
  const dates = Array.from(new Set(rows.map((r) => r.metric_date))).sort();
  const currentDates = new Set(dates.slice(-n));
  const previousDates = new Set(dates.slice(-n * 2, -n));
  return {
    current: rows.filter((r) => currentDates.has(r.metric_date)),
    previous: rows.filter((r) => previousDates.has(r.metric_date)),
  };
}

export interface Ga4TrendPoint {
  date: string;
  label: string;
  sessions: number;
  activeUsers: number;
  screenPageViews: number;
  engagementRate: number;
}

function trendLabel(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00.000Z`);
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });
}

export function buildGa4Trend(rows: Ga4DailyMetricRow[]): Ga4TrendPoint[] {
  return [...rows]
    .sort((a, b) => a.metric_date.localeCompare(b.metric_date))
    .map((row) => ({
      date: row.metric_date,
      label: trendLabel(row.metric_date),
      sessions: row.sessions,
      activeUsers: row.active_users,
      screenPageViews: row.screen_page_views,
      engagementRate: row.sessions > 0 ? (row.engaged_sessions / row.sessions) * 100 : 0,
    }));
}

export interface Ga4Summary {
  sessions: number;
  activeUsers: number;
  newUsers: number;
  screenPageViews: number;
  conversions: number;
  whatsappClicks: number;
  engagementRate: number;
  avgEngagementSeconds: number;
}

export function summarizeGa4(rows: Ga4DailyMetricRow[]): Ga4Summary {
  const totals = rows.reduce(
    (acc, row) => ({
      sessions: acc.sessions + row.sessions,
      activeUsers: acc.activeUsers + row.active_users,
      newUsers: acc.newUsers + row.new_users,
      screenPageViews: acc.screenPageViews + row.screen_page_views,
      conversions: acc.conversions + row.conversions,
      whatsappClicks: acc.whatsappClicks + row.whatsapp_clicks,
      engagedSessions: acc.engagedSessions + row.engaged_sessions,
      engagementDuration: acc.engagementDuration + row.user_engagement_duration_seconds,
    }),
    {
      sessions: 0,
      activeUsers: 0,
      newUsers: 0,
      screenPageViews: 0,
      conversions: 0,
      whatsappClicks: 0,
      engagedSessions: 0,
      engagementDuration: 0,
    }
  );
  return {
    sessions: totals.sessions,
    activeUsers: totals.activeUsers,
    newUsers: totals.newUsers,
    screenPageViews: totals.screenPageViews,
    conversions: totals.conversions,
    whatsappClicks: totals.whatsappClicks,
    engagementRate: totals.sessions > 0 ? (totals.engagedSessions / totals.sessions) * 100 : 0,
    avgEngagementSeconds: totals.sessions > 0 ? totals.engagementDuration / totals.sessions : 0,
  };
}

/**
 * Tradução dos canais do GA4 para termos que qualquer pessoa do time entende,
 * com uma explicação curta de onde essa sessão realmente veio.
 */
const CHANNEL_LABELS: Record<string, { label: string; hint: string }> = {
  Direct: { label: "Acesso direto", hint: "Digitou o site ou usou um favorito" },
  "Organic Search": { label: "Busca orgânica", hint: "Achou no Google/Bing sem anúncio" },
  "Paid Search": { label: "Busca paga", hint: "Clicou em anúncio do Google Ads" },
  "Organic Social": { label: "Redes sociais (orgânico)", hint: "Veio do Instagram/LinkedIn sem impulsionar" },
  "Paid Social": { label: "Redes sociais (pago)", hint: "Clicou em anúncio nas redes" },
  Referral: { label: "Indicação de outro site", hint: "Outro site linkou para o seu" },
  Email: { label: "E-mail marketing", hint: "Clicou num link de e-mail" },
  Affiliates: { label: "Afiliados", hint: "Veio de um parceiro/afiliado" },
  Display: { label: "Anúncio display", hint: "Clicou num banner" },
  "Organic Video": { label: "Vídeo orgânico", hint: "Veio do YouTube sem impulsionar" },
  "Paid Video": { label: "Vídeo pago", hint: "Clicou em anúncio em vídeo" },
  "Cross-network": { label: "Múltiplos canais", hint: "Campanha combinando vários canais" },
  "AI Assistant": { label: "Assistente de IA", hint: "Veio de ChatGPT/Perplexity/Copilot etc." },
  Unassigned: { label: "Não identificado", hint: "O GA4 não conseguiu classificar a origem" },
  "(não definido)": { label: "Não identificado", hint: "O GA4 não conseguiu classificar a origem" },
};

export function translateGa4Channel(channelGroup: string): { label: string; hint: string } {
  return CHANNEL_LABELS[channelGroup] ?? { label: channelGroup, hint: "Origem sem categoria conhecida" };
}

export interface Ga4ChannelSummary {
  channel: string;
  hint: string;
  sessions: number;
  share: number;
}

export function summarizeGa4Channels(rows: Ga4ChannelMetricRow[]): Ga4ChannelSummary[] {
  const byChannel = new Map<string, number>();
  let total = 0;
  for (const row of rows) {
    byChannel.set(row.channel_group, (byChannel.get(row.channel_group) ?? 0) + row.sessions);
    total += row.sessions;
  }
  return Array.from(byChannel.entries())
    .map(([channelGroup, sessions]) => {
      const { label, hint } = translateGa4Channel(channelGroup);
      return { channel: label, hint, sessions, share: total > 0 ? (sessions / total) * 100 : 0 };
    })
    .sort((a, b) => b.sessions - a.sessions);
}

export interface Ga4DeviceSummary {
  device: string;
  sessions: number;
  share: number;
}

const DEVICE_LABELS: Record<string, string> = {
  desktop: "Computador",
  mobile: "Celular",
  tablet: "Tablet",
};

export function summarizeGa4Devices(rows: Ga4DeviceMetricRow[]): Ga4DeviceSummary[] {
  const byDevice = new Map<string, number>();
  let total = 0;
  for (const row of rows) {
    byDevice.set(row.device_category, (byDevice.get(row.device_category) ?? 0) + row.sessions);
    total += row.sessions;
  }
  return Array.from(byDevice.entries())
    .map(([deviceCategory, sessions]) => ({
      device: DEVICE_LABELS[deviceCategory.toLowerCase()] ?? deviceCategory,
      sessions,
      share: total > 0 ? (sessions / total) * 100 : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions);
}

export interface Ga4PageSummary {
  pagePath: string;
  pageTitle: string | null;
  sessions: number;
  screenPageViews: number;
  share: number;
}

export function aggregateGa4Pages(rows: Ga4PageMetricRow[], limit = 15): Ga4PageSummary[] {
  const byPath = new Map<string, { title: string | null; sessions: number; views: number }>();
  let totalViews = 0;
  for (const row of rows) {
    const existing = byPath.get(row.page_path) ?? { title: row.page_title, sessions: 0, views: 0 };
    existing.sessions += row.sessions;
    existing.views += row.screen_page_views;
    if (!existing.title && row.page_title) existing.title = row.page_title;
    byPath.set(row.page_path, existing);
    totalViews += row.screen_page_views;
  }
  return Array.from(byPath.entries())
    .map(([pagePath, v]) => ({
      pagePath,
      pageTitle: v.title,
      sessions: v.sessions,
      screenPageViews: v.views,
      share: totalViews > 0 ? (v.views / totalViews) * 100 : 0,
    }))
    .sort((a, b) => b.screenPageViews - a.screenPageViews)
    .slice(0, limit);
}

export interface Ga4LocationSummary {
  city: string;
  country: string;
  sessions: number;
  activeUsers: number;
  share: number;
}

export function aggregateGa4Locations(rows: Ga4LocationMetricRow[], limit = 15): Ga4LocationSummary[] {
  const byCity = new Map<string, { country: string; sessions: number; activeUsers: number }>();
  let total = 0;
  for (const row of rows) {
    const key = `${row.city}__${row.country}`;
    const existing = byCity.get(key) ?? { country: row.country, sessions: 0, activeUsers: 0 };
    existing.sessions += row.sessions;
    existing.activeUsers += row.active_users;
    byCity.set(key, existing);
    total += row.sessions;
  }
  return Array.from(byCity.entries())
    .map(([key, v]) => ({
      city: key.split("__")[0],
      country: v.country,
      sessions: v.sessions,
      activeUsers: v.activeUsers,
      share: total > 0 ? (v.sessions / total) * 100 : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, limit);
}

export interface Ga4LandingPageSummary {
  landingPage: string;
  sessions: number;
  conversions: number;
  conversionRate: number;
}

/** Quais páginas de entrada realmente viram lead — a métrica que mais interessa ao MKT. */
export function aggregateGa4LandingPages(rows: Ga4LandingPageMetricRow[], limit = 12): Ga4LandingPageSummary[] {
  const byPage = new Map<string, { sessions: number; conversions: number }>();
  for (const row of rows) {
    const existing = byPage.get(row.landing_page) ?? { sessions: 0, conversions: 0 };
    existing.sessions += row.sessions;
    existing.conversions += row.conversions;
    byPage.set(row.landing_page, existing);
  }
  return Array.from(byPage.entries())
    .map(([landingPage, v]) => ({
      landingPage,
      sessions: v.sessions,
      conversions: v.conversions,
      conversionRate: v.sessions > 0 ? (v.conversions / v.sessions) * 100 : 0,
    }))
    .filter((p) => p.sessions > 0)
    .sort((a, b) => b.conversions - a.conversions || b.sessions - a.sessions)
    .slice(0, limit);
}

/** Nome técnico do evento-chave → o que isso significa em português claro. */
const KEY_EVENT_LABELS: Record<string, string> = {
  form_submit: "Formulário enviado no site",
  ads_conversion_Fale_conosco_1: "Conversão de anúncio (Google Ads)",
  purchase: "Compra (e-commerce, não usado)",
};

export interface Ga4KeyEventSummary {
  eventName: string;
  label: string;
  count: number;
  share: number;
}

export function aggregateGa4KeyEvents(rows: Ga4KeyEventMetricRow[]): Ga4KeyEventSummary[] {
  const byEvent = new Map<string, number>();
  let total = 0;
  for (const row of rows) {
    byEvent.set(row.event_name, (byEvent.get(row.event_name) ?? 0) + row.event_count);
    total += row.event_count;
  }
  return Array.from(byEvent.entries())
    .map(([eventName, count]) => ({
      eventName,
      label: KEY_EVENT_LABELS[eventName] ?? eventName,
      count,
      share: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

/** Cidades brasileiras conhecidas (heurística simples pra separar público real de ruído de datacenter). */
const KNOWN_SUSPECT_LOCATIONS = new Set(["Xinjiang", "Ashburn", "Singapore", "(not set)"]);

export function isLikelySuspectLocation(city: string): boolean {
  return KNOWN_SUSPECT_LOCATIONS.has(city) || city === "(não definido)";
}

/** Resumo em português, pronto pra bater o olho: o que aconteceu e o que isso significa. */
export function buildGa4Insight(input: {
  summary: Ga4Summary;
  previousSummary: Ga4Summary;
  channels: Ga4ChannelSummary[];
  locations: Ga4LocationSummary[];
  devices: Ga4DeviceSummary[];
  landingPages: Ga4LandingPageSummary[];
  rangeDays: number;
}): string {
  const { summary, previousSummary, channels, locations, devices, landingPages, rangeDays } = input;
  const parts: string[] = [];

  const growth =
    previousSummary.sessions > 0
      ? ((summary.sessions - previousSummary.sessions) / previousSummary.sessions) * 100
      : null;
  if (growth === null) {
    parts.push(`Nos últimos ${rangeDays} dias o site teve ${summary.sessions.toLocaleString("pt-BR")} sessões.`);
  } else if (growth >= 0) {
    parts.push(
      `Nos últimos ${rangeDays} dias o site cresceu ${growth.toFixed(0)}% em sessões (${summary.sessions.toLocaleString("pt-BR")}) frente ao período anterior.`
    );
  } else {
    parts.push(
      `Nos últimos ${rangeDays} dias o site caiu ${Math.abs(growth).toFixed(0)}% em sessões (${summary.sessions.toLocaleString("pt-BR")}) frente ao período anterior — vale investigar.`
    );
  }

  const topChannel = channels[0];
  if (topChannel) {
    parts.push(`A maior parte do tráfego veio de "${topChannel.channel}" (${topChannel.share.toFixed(0)}%).`);
  }

  const realLocations = locations.filter((l) => !isLikelySuspectLocation(l.city));
  const topLocation = realLocations[0];
  if (topLocation) {
    parts.push(`A cidade que mais acessa é ${topLocation.city}${topLocation.country !== "Brazil" ? ` (${topLocation.country})` : ""}.`);
  }

  if (summary.conversions > 0) {
    const topConverting = [...landingPages].sort((a, b) => b.conversions - a.conversions)[0];
    if (topConverting) {
      parts.push(
        `Foram ${summary.conversions.toLocaleString("pt-BR")} conversões (formulários/leads) no período — a página "${topConverting.landingPage}" foi a que mais converteu (${topConverting.conversions.toLocaleString("pt-BR")} de ${topConverting.sessions.toLocaleString("pt-BR")} sessões).`
      );
    } else {
      parts.push(`Foram ${summary.conversions.toLocaleString("pt-BR")} conversões (formulários/leads) no período.`);
    }
  }

  if (summary.whatsappClicks > 0) {
    parts.push(`O botão do WhatsApp foi clicado ${summary.whatsappClicks.toLocaleString("pt-BR")} vezes.`);
  }

  const newShare = summary.activeUsers > 0 ? (summary.newUsers / summary.activeUsers) * 100 : 0;
  parts.push(`${newShare.toFixed(0)}% dos usuários são novos visitantes.`);

  const mobile = devices.find((d) => d.device === "Celular");
  if (mobile && mobile.share >= 40) {
    parts.push(`Atenção: ${mobile.share.toFixed(0)}% do acesso é pelo celular — vale conferir a experiência mobile do site.`);
  }

  return parts.join(" ");
}

/* ===================================================================== */
/* Tela de Métricas do Site (período da URL + comparação)                 */
/* ===================================================================== */

/** Linhas com metric_date dentro de [from, to] (AAAA-MM-DD, pontas incluídas). */
export function ga4RowsInRange<T extends { metric_date: string }>(rows: T[], from: string, to: string): T[] {
  return rows.filter((row) => isDateInRange(row.metric_date, from, to));
}

export interface Ga4PeriodTotals {
  /** Dias do período com linha no banco (0 = sem dado, os números ficam null). */
  daysWithData: number;
  sessions: number | null;
  /** Soma dos usuários ativos de cada dia (quem volta em outro dia conta de novo). */
  activeUsers: number | null;
  newUsers: number | null;
  screenPageViews: number | null;
  engagedSessions: number | null;
  conversions: number | null;
  whatsappClicks: number | null;
  /** Sessões engajadas ÷ sessões, em %. */
  engagementRate: number | null;
  /** Segundos de engajamento ÷ usuários ativos (soma dos dias). */
  engagementSecondsPerUser: number | null;
}

export function summarizeGa4Period(rows: Ga4DailyMetricRow[], from: string, to: string): Ga4PeriodTotals {
  const scoped = ga4RowsInRange(rows, from, to);
  if (scoped.length === 0) {
    return {
      daysWithData: 0,
      sessions: null,
      activeUsers: null,
      newUsers: null,
      screenPageViews: null,
      engagedSessions: null,
      conversions: null,
      whatsappClicks: null,
      engagementRate: null,
      engagementSecondsPerUser: null,
    };
  }
  let sessions = 0;
  let activeUsers = 0;
  let newUsers = 0;
  let screenPageViews = 0;
  let engagedSessions = 0;
  let conversions = 0;
  let whatsappClicks = 0;
  let engagementSeconds = 0;
  for (const row of scoped) {
    sessions += Number(row.sessions ?? 0);
    activeUsers += Number(row.active_users ?? 0);
    newUsers += Number(row.new_users ?? 0);
    screenPageViews += Number(row.screen_page_views ?? 0);
    engagedSessions += Number(row.engaged_sessions ?? 0);
    conversions += Number(row.conversions ?? 0);
    whatsappClicks += Number(row.whatsapp_clicks ?? 0);
    engagementSeconds += Number(row.user_engagement_duration_seconds ?? 0);
  }
  return {
    daysWithData: scoped.length,
    sessions,
    activeUsers,
    newUsers,
    screenPageViews,
    engagedSessions,
    conversions,
    whatsappClicks,
    engagementRate: sessions > 0 ? (engagedSessions / sessions) * 100 : null,
    engagementSecondsPerUser: activeUsers > 0 ? engagementSeconds / activeUsers : null,
  };
}

export type Ga4DailyMetricKey =
  | "sessions"
  | "activeUsers"
  | "conversions"
  | "whatsappClicks"
  | "engagementRate"
  | "engagementSecondsPerUser";

function ga4DailyValue(row: Ga4DailyMetricRow, key: Ga4DailyMetricKey): number | null {
  switch (key) {
    case "sessions":
      return Number(row.sessions ?? 0);
    case "activeUsers":
      return Number(row.active_users ?? 0);
    case "conversions":
      return Number(row.conversions ?? 0);
    case "whatsappClicks":
      return Number(row.whatsapp_clicks ?? 0);
    case "engagementRate":
      return row.sessions > 0 ? (Number(row.engaged_sessions ?? 0) / row.sessions) * 100 : null;
    case "engagementSecondsPerUser":
      return row.active_users > 0 ? Number(row.user_engagement_duration_seconds ?? 0) / row.active_users : null;
  }
}

/** Um ponto por dia de [from, to]; null quando o dia não tem linha no banco. */
export function ga4DailySeries(
  rows: Ga4DailyMetricRow[],
  key: Ga4DailyMetricKey,
  from: string,
  to: string
): { date: string; value: number | null }[] {
  const byDate = new Map(ga4RowsInRange(rows, from, to).map((row) => [row.metric_date, row]));
  return eachDate(from, to).map((date) => {
    const row = byDate.get(date);
    return { date, value: row ? ga4DailyValue(row, key) : null };
  });
}

/** "48 s" / "1 min 05 s" a partir de segundos. */
export function formatGa4Duration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return "—";
  const total = Math.round(seconds);
  if (total < 60) return `${total} s`;
  return `${Math.floor(total / 60)} min ${String(total % 60).padStart(2, "0")} s`;
}

/* ----------------------------------------------------------------- canais */

/** Grupos de canal do GA4 que contam como "veio das redes sociais". */
export const GA4_SOCIAL_CHANNELS = ["Organic Social", "Paid Social"] as const;

export function isGa4SocialChannel(channelGroup: string): boolean {
  return (GA4_SOCIAL_CHANNELS as readonly string[]).includes(channelGroup);
}

export interface Ga4ChannelBreakdown {
  /** Grupo original do GA4 (escolhe o ícone). */
  channelGroup: string;
  label: string;
  hint: string;
  sessions: number;
  previousSessions: number;
  /** % das sessões do período que vieram por esse canal. */
  share: number;
}

/** Canais do período (traduzidos) com as sessões do período de comparação. */
export function ga4ChannelBreakdown(
  rows: Ga4ChannelMetricRow[],
  period: { from: string; to: string; compareFrom: string; compareTo: string }
): Ga4ChannelBreakdown[] {
  const byLabel = new Map<string, Ga4ChannelBreakdown>();
  let total = 0;
  for (const row of rows) {
    const inCurrent = isDateInRange(row.metric_date, period.from, period.to);
    const inPrevious = isDateInRange(row.metric_date, period.compareFrom, period.compareTo);
    if (!inCurrent && !inPrevious) continue;
    const { label, hint } = translateGa4Channel(row.channel_group);
    const entry = byLabel.get(label) ?? { channelGroup: row.channel_group, label, hint, sessions: 0, previousSessions: 0, share: 0 };
    const sessions = Number(row.sessions ?? 0);
    if (inCurrent) {
      entry.sessions += sessions;
      total += sessions;
    }
    if (inPrevious) entry.previousSessions += sessions;
    byLabel.set(label, entry);
  }
  return Array.from(byLabel.values())
    .filter((entry) => entry.sessions > 0)
    .map((entry) => ({ ...entry, share: total > 0 ? (entry.sessions / total) * 100 : 0 }))
    .sort((a, b) => b.sessions - a.sessions);
}

export interface Ga4SocialTraffic {
  /** null quando o período não tem dado do site. */
  sessions: number | null;
  organic: number;
  paid: number;
  /** % das sessões do site que vieram das redes. */
  share: number | null;
}

export function ga4SocialTraffic(
  channelRows: Ga4ChannelMetricRow[],
  dailyRows: Ga4DailyMetricRow[],
  from: string,
  to: string
): Ga4SocialTraffic {
  const totals = summarizeGa4Period(dailyRows, from, to);
  if (totals.sessions === null) return { sessions: null, organic: 0, paid: 0, share: null };
  let organic = 0;
  let paid = 0;
  for (const row of ga4RowsInRange(channelRows, from, to)) {
    if (row.channel_group === "Organic Social") organic += Number(row.sessions ?? 0);
    else if (row.channel_group === "Paid Social") paid += Number(row.sessions ?? 0);
  }
  const sessions = organic + paid;
  return { sessions, organic, paid, share: totals.sessions > 0 ? (sessions / totals.sessions) * 100 : null };
}

/** Sessões vindas das redes, dia a dia (null nos dias sem dado do site). */
export function ga4SocialSeries(
  channelRows: Ga4ChannelMetricRow[],
  dailyRows: Ga4DailyMetricRow[],
  from: string,
  to: string
): { date: string; value: number | null }[] {
  const daysWithData = new Set(ga4RowsInRange(dailyRows, from, to).map((row) => row.metric_date));
  const socialByDate = new Map<string, number>();
  for (const row of ga4RowsInRange(channelRows, from, to)) {
    if (!isGa4SocialChannel(row.channel_group)) continue;
    socialByDate.set(row.metric_date, (socialByDate.get(row.metric_date) ?? 0) + Number(row.sessions ?? 0));
  }
  return eachDate(from, to).map((date) => ({ date, value: daysWithData.has(date) ? socialByDate.get(date) ?? 0 : null }));
}

/* ----------------------------------------------------------- eventos-chave */

export function ga4KeyEventLabel(eventName: string): string {
  return KEY_EVENT_LABELS[eventName] ?? eventName;
}

/** Total de cada evento-chave num intervalo (para a variação contra o período anterior). */
export function ga4KeyEventTotals(rows: Ga4KeyEventMetricRow[], from: string, to: string): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of ga4RowsInRange(rows, from, to)) {
    totals.set(row.event_name, (totals.get(row.event_name) ?? 0) + Number(row.event_count ?? 0));
  }
  return totals;
}

/* ------------------------------------------------------------- localização */

/**
 * Além dos já conhecidos em isLikelySuspectLocation: cidades de Xinjiang
 * (Kashgar, Urumqi) e de data centers (Google em Council Bluffs e The Dalles,
 * AWS em Boardman), que aparecem no GA4 como robô, não como público.
 */
const EXTRA_SUSPECT_CITIES = new Set(["Kashgar Prefecture", "Urumqi", "Council Bluffs", "The Dalles", "Boardman"]);

export function isSuspectGa4Location(city: string, country?: string | null): boolean {
  return isLikelySuspectLocation(city) || EXTRA_SUSPECT_CITIES.has(city) || country === "(not set)";
}

/** Quanto das sessões do período veio de locais típicos de robô (piso: só as cidades que o GA4 manda). */
export function ga4SuspectTraffic(
  locationRows: Ga4LocationMetricRow[],
  dailyRows: Ga4DailyMetricRow[],
  from: string,
  to: string
): { suspectSessions: number; totalSessions: number; share: number | null } {
  const totalSessions = summarizeGa4Period(dailyRows, from, to).sessions ?? 0;
  let suspectSessions = 0;
  for (const row of ga4RowsInRange(locationRows, from, to)) {
    if (isSuspectGa4Location(row.city, row.country)) suspectSessions += Number(row.sessions ?? 0);
  }
  return { suspectSessions, totalSessions, share: totalSessions > 0 ? Math.min(100, (suspectSessions / totalSessions) * 100) : null };
}

const COUNTRY_LABELS: Record<string, string> = {
  Brazil: "Brasil",
  "United States": "Estados Unidos",
  China: "China",
  Singapore: "Singapura",
  Portugal: "Portugal",
  Germany: "Alemanha",
  France: "França",
  Spain: "Espanha",
  Italy: "Itália",
  "United Kingdom": "Reino Unido",
  Ireland: "Irlanda",
  Netherlands: "Países Baixos",
  Canada: "Canadá",
  Argentina: "Argentina",
  Mexico: "México",
  Chile: "Chile",
  Japan: "Japão",
  India: "Índia",
  Russia: "Rússia",
  "(not set)": "País não identificado",
};

export function translateGa4Country(country: string): string {
  return COUNTRY_LABELS[country] ?? country;
}

export function translateGa4City(city: string): string {
  return city === "(not set)" || city === "(não definido)" ? "Cidade não identificada" : city;
}

/* ----------------------------------------------------------------- páginas */

/** Tipo de página deduzido do caminho da URL: serve só para escolher o ícone. */
export type Ga4PageKind = "inicio" | "contato" | "area" | "conteudo" | "equipe" | "carreiras" | "institucional" | "outra";

export const GA4_PAGE_KIND_LABELS: Record<Ga4PageKind, string> = {
  inicio: "Página inicial",
  contato: "Contato",
  area: "Área de atuação",
  conteudo: "Artigo ou material",
  equipe: "Equipe",
  carreiras: "Trabalhe conosco",
  institucional: "Sobre o escritório",
  outra: "Outra página",
};

export function classifyGa4PagePath(path: string): Ga4PageKind {
  const clean = path.toLowerCase().split("?")[0].replace(/\.php$/, "").replace(/\/+$/, "");
  if (clean === "" || clean === "/index") return "inicio";
  if (/contato|fale-conosco|cadastro-lead/.test(clean)) return "contato";
  if (/trabalhe-conosco|careers|carreira|vagas/.test(clean)) return "carreiras";
  if (/equipe|socios/.test(clean)) return "equipe";
  if (/blog|noticia|artigo|ebook|material|publicac|post\//.test(clean)) return "conteudo";
  if (/advocacia-bismarchi|sobre|quem-somos|escritorio/.test(clean)) return "institucional";
  if (
    /advogad|areas-de-atuacao|recuperacao|reestruturacao|tributari|trabalhist|empresarial|civel|societari|contratu|legal-operations|operacoes-legais|direito|compliance|imobiliari|agronegocio|familia/.test(
      clean
    )
  ) {
    return "area";
  }
  return "outra";
}

/** Tira o " | Bismarchi | Pires" do fim do título da página. */
export function cleanGa4PageTitle(title: string | null | undefined): string | null {
  if (!title) return null;
  let clean = title.trim();
  for (let i = 0; i < 3; i += 1) {
    const next = clean.replace(/\s*[|–-]\s*Bismarchi\s*\|\s*Pires\s*$/i, "").trim();
    if (next === clean) break;
    clean = next;
  }
  return clean || null;
}

/** Título mais recente conhecido de cada caminho (as páginas de entrada não têm título próprio). */
export function ga4PageTitles(rows: Ga4PageMetricRow[]): Map<string, string> {
  const titles = new Map<string, { date: string; title: string }>();
  for (const row of rows) {
    const title = cleanGa4PageTitle(row.page_title);
    if (!title) continue;
    const known = titles.get(row.page_path);
    if (!known || row.metric_date > known.date) titles.set(row.page_path, { date: row.metric_date, title });
  }
  return new Map(Array.from(titles.entries()).map(([path, value]) => [path, value.title]));
}

export function isGa4UnknownPath(path: string): boolean {
  return path === "(not set)" || path === "(não definido)" || path.trim() === "";
}

export interface Ga4PageDetail {
  views: number;
  sessions: number;
  previousViews: number;
  previousSessions: number;
  entrances: number;
  leads: number;
  previousEntrances: number;
  previousLeads: number;
}

/** Números de um caminho no período e no de comparação (como página vista e como página de entrada). */
export function ga4PageDetail(
  path: string,
  pageRows: Ga4PageMetricRow[],
  landingRows: Ga4LandingPageMetricRow[],
  period: { from: string; to: string; compareFrom: string; compareTo: string }
): Ga4PageDetail {
  const detail: Ga4PageDetail = { views: 0, sessions: 0, previousViews: 0, previousSessions: 0, entrances: 0, leads: 0, previousEntrances: 0, previousLeads: 0 };
  for (const row of pageRows) {
    if (row.page_path !== path) continue;
    if (isDateInRange(row.metric_date, period.from, period.to)) {
      detail.views += Number(row.screen_page_views ?? 0);
      detail.sessions += Number(row.sessions ?? 0);
    } else if (isDateInRange(row.metric_date, period.compareFrom, period.compareTo)) {
      detail.previousViews += Number(row.screen_page_views ?? 0);
      detail.previousSessions += Number(row.sessions ?? 0);
    }
  }
  for (const row of landingRows) {
    if (row.landing_page !== path) continue;
    if (isDateInRange(row.metric_date, period.from, period.to)) {
      detail.entrances += Number(row.sessions ?? 0);
      detail.leads += Number(row.conversions ?? 0);
    } else if (isDateInRange(row.metric_date, period.compareFrom, period.compareTo)) {
      detail.previousEntrances += Number(row.sessions ?? 0);
      detail.previousLeads += Number(row.conversions ?? 0);
    }
  }
  return detail;
}

/**
 * Visualizações de um caminho dia a dia. O GA4 não manda linha de dia sem
 * visita, então dia com dado do site e sem linha da página vale zero.
 */
export function ga4PageViewsSeries(
  path: string,
  pageRows: Ga4PageMetricRow[],
  dailyRows: Ga4DailyMetricRow[],
  from: string,
  to: string
): { date: string; value: number | null }[] {
  const daysWithData = new Set(ga4RowsInRange(dailyRows, from, to).map((row) => row.metric_date));
  const views = new Map<string, number>();
  for (const row of ga4RowsInRange(pageRows, from, to)) {
    if (row.page_path !== path) continue;
    views.set(row.metric_date, (views.get(row.metric_date) ?? 0) + Number(row.screen_page_views ?? 0));
  }
  return eachDate(from, to).map((date) => ({ date, value: daysWithData.has(date) ? views.get(date) ?? 0 : null }));
}
