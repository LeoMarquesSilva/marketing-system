import type {
  Ga4ChannelMetricRow,
  Ga4DailyMetricRow,
  Ga4DeviceMetricRow,
  Ga4KeyEventMetricRow,
  Ga4LandingPageMetricRow,
  Ga4LocationMetricRow,
  Ga4PageMetricRow,
} from "@/lib/ga4-server";

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
