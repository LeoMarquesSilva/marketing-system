const GRAPH_API_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export type MetaDatePreset =
  | "today"
  | "yesterday"
  | "last_7d"
  | "last_14d"
  | "last_30d"
  | "last_90d"
  | "this_month"
  | "last_month"
  | "maximum";

export const META_DATE_PRESETS: { value: MetaDatePreset; label: string }[] = [
  { value: "maximum", label: "Todo o período" },
  { value: "last_7d", label: "Últimos 7 dias" },
  { value: "last_14d", label: "Últimos 14 dias" },
  { value: "last_30d", label: "Últimos 30 dias" },
  { value: "last_90d", label: "Últimos 90 dias" },
  { value: "this_month", label: "Este mês" },
  { value: "last_month", label: "Mês passado" },
];

export interface MetaAdAccount {
  id: string;
  name: string;
  account_status: number;
  currency: string;
}

export interface MetaMessagingMetrics {
  /** Conversas iniciadas no WhatsApp/Messenger (7d attribution) */
  conversations_started: number;
  /** Conexões totais de mensagem */
  messaging_connections: number;
  /** Primeira resposta do usuário */
  first_replies: number;
  /** Conversas com resposta em 7d */
  conversations_replied: number;
  /** Custo por conversa iniciada */
  cost_per_conversation: number | null;
}

export interface MetaAccountInsights {
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
  cpc: number;
  cpm: number;
  reach: number;
  frequency: number;
  messaging: MetaMessagingMetrics;
}

export interface MetaAdPerformance {
  ad_id: string;
  campaign_id: string;
  adset_id: string;
  ad_name: string;
  campaign_name: string;
  adset_name: string;
  status: string;
  effective_status: string;
  thumbnail_url: string | null;
  image_url: string | null;
  video_id: string | null;
  media_type: "video" | "image" | "none";
  creative_message: string | null;
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
  cpc: number;
  cpm: number;
  reach: number;
  frequency: number;
  link_clicks: number;
  cost_per_link_click: number | null;
  messaging: MetaMessagingMetrics;
}

export interface MetaCampaignPerformance {
  campaign_id: string;
  campaign_name: string;
  effective_status: string;
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
  reach: number;
  messaging: MetaMessagingMetrics;
}

export interface MetaAdSetPerformance {
  adset_id: string;
  adset_name: string;
  campaign_id: string;
  effective_status: string;
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
  reach: number;
  messaging: MetaMessagingMetrics;
}

export interface MetaAdSetGroup extends MetaAdSetPerformance {
  ads: MetaAdPerformance[];
}

export interface MetaCampaignGroup extends MetaCampaignPerformance {
  adsets: MetaAdSetGroup[];
}

export interface MetaAdsDashboard {
  account: MetaAdAccount;
  datePreset: MetaDatePreset;
  accountInsights: MetaAccountInsights;
  campaigns: MetaCampaignGroup[];
  fetchedAt: string;
  /** Meta Ads Insights costuma ter atraso de ~15 min */
  dataLatencyNote: string;
}

/** Intervalo sugerido de auto-refresh (Meta não é tempo real) */
export const META_ADS_REFRESH_MS = 3 * 60 * 1000;

export function isAdsEntityActive(status: string): boolean {
  return status === "ACTIVE";
}

/** Token da Marketing API — separado do TOKEN_META_BP (Instagram/Página). */
function getMetaAdsToken(): string {
  const raw =
    process.env.TOKEN_META_ADS?.trim() ||
    process.env.TOKEN_META_BP?.trim() ||
    "";
  if (!raw) {
    throw new Error(
      "TOKEN_META_ADS não configurado. Use um token com permissão ads_read (diferente do token de Instagram)."
    );
  }
  if (!process.env.TOKEN_META_ADS?.trim() && process.env.TOKEN_META_BP?.trim()) {
    console.warn(
      "[meta-ads] TOKEN_META_ADS ausente — usando TOKEN_META_BP. " +
        "Tokens de Instagram (tipo PAGE) normalmente não têm ads_read."
    );
  }
  return raw.replace(/^Bearer\s+/i, "").trim();
}

function normalizeAdAccountId(id: string): string {
  const trimmed = id.trim();
  return trimmed.startsWith("act_") ? trimmed : `act_${trimmed}`;
}

export function getConfiguredAdAccountId(): string | null {
  const raw = process.env.META_AD_ACCOUNT_ID?.trim();
  if (!raw) return null;
  return normalizeAdAccountId(raw);
}

async function graphFetch<T>(path: string): Promise<T> {
  const token = getMetaAdsToken();
  const url = `${GRAPH_BASE}${path}`;
  const headers = { Authorization: `Bearer ${token}` };
  let res: Response | null = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    res = await fetch(url, { cache: "no-store", headers });
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 700));
      continue;
    }
    break;
  }
  if (!res) throw new Error("Sem resposta da Graph API.");
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Erro na Graph API (${res.status})`);
  }
  return json as T;
}

async function graphFetchPaginated<T>(
  path: string,
  maxItems = 500
): Promise<T[]> {
  const token = getMetaAdsToken();
  const collected: T[] = [];
  let nextUrl: string | null = `${GRAPH_BASE}${path}`;

  while (nextUrl && collected.length < maxItems) {
    let res: Response | null = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      res = await fetch(nextUrl, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      if ((res.status === 429 || res.status >= 500) && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 700));
        continue;
      }
      break;
    }
    if (!res) throw new Error("Sem resposta da Graph API.");
    const json: {
      data?: T[];
      paging?: { next?: string };
      error?: { message?: string };
    } = await res.json();
    if (!res.ok || json.error) {
      throw new Error(json.error?.message ?? `Erro na Graph API (${res.status})`);
    }
    collected.push(...(json.data ?? []));
    nextUrl = json.paging?.next ?? null;
  }

  return collected.slice(0, maxItems);
}

function parseNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function parseActionCount(
  actions: { action_type: string; value: string }[] | undefined,
  types: string[]
): number {
  if (!actions?.length) return 0;
  for (const type of types) {
    const hit = actions.find((a) => a.action_type === type);
    if (hit) return parseNumber(hit.value);
  }
  return 0;
}

function parseCostPerAction(
  costs: { action_type: string; value: string }[] | undefined,
  types: string[]
): number | null {
  if (!costs?.length) return null;
  for (const type of types) {
    const hit = costs.find((c) => c.action_type === type);
    if (hit) {
      const n = parseNumber(hit.value);
      return n > 0 ? n : null;
    }
  }
  return null;
}

function parseMessagingMetrics(row: {
  actions?: { action_type: string; value: string }[];
  cost_per_action_type?: { action_type: string; value: string }[];
}): MetaMessagingMetrics {
  return {
    conversations_started: parseActionCount(row.actions, [
      "onsite_conversion.messaging_conversation_started_7d",
      "messaging_conversation_started_7d",
    ]),
    messaging_connections: parseActionCount(row.actions, [
      "onsite_conversion.total_messaging_connection",
    ]),
    first_replies: parseActionCount(row.actions, [
      "onsite_conversion.messaging_first_reply",
    ]),
    conversations_replied: parseActionCount(row.actions, [
      "onsite_conversion.messaging_conversation_replied_7d",
    ]),
    cost_per_conversation: parseCostPerAction(row.cost_per_action_type, [
      "onsite_conversion.messaging_conversation_started_7d",
      "messaging_conversation_started_7d",
    ]),
  };
}

const EMPTY_MESSAGING: MetaMessagingMetrics = {
  conversations_started: 0,
  messaging_connections: 0,
  first_replies: 0,
  conversations_replied: 0,
  cost_per_conversation: null,
};

function parseInsightsRow(row: {
  impressions?: string;
  clicks?: string;
  spend?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  reach?: string;
  frequency?: string;
  actions?: { action_type: string; value: string }[];
  cost_per_action_type?: { action_type: string; value: string }[];
}): Omit<MetaAccountInsights, "messaging"> & {
  link_clicks: number;
  cost_per_link_click: number | null;
  messaging: MetaMessagingMetrics;
} {
  const linkClicks = parseActionCount(row.actions, [
    "link_click",
    "outbound_click",
  ]);
  return {
    impressions: parseNumber(row.impressions),
    clicks: parseNumber(row.clicks),
    spend: parseNumber(row.spend),
    ctr: parseNumber(row.ctr),
    cpc: parseNumber(row.cpc),
    cpm: parseNumber(row.cpm),
    reach: parseNumber(row.reach),
    frequency: parseNumber(row.frequency),
    link_clicks: linkClicks,
    cost_per_link_click: parseCostPerAction(row.cost_per_action_type, [
      "link_click",
      "outbound_click",
    ]),
    messaging: parseMessagingMetrics(row),
  };
}

export async function fetchAdAccounts(): Promise<MetaAdAccount[]> {
  const data = await graphFetch<{
    data: { id: string; name: string; account_status: number; currency: string }[];
  }>("/me/adaccounts?fields=id,name,account_status,currency&limit=50");

  return (data.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    account_status: a.account_status ?? 0,
    currency: a.currency ?? "BRL",
  }));
}

export async function resolveAdAccountId(): Promise<string> {
  const configured = getConfiguredAdAccountId();

  if (configured) {
    try {
      await fetchAdAccountDetails(configured);
      return configured;
    } catch {
      const accounts = await fetchAdAccounts();
      const list = accounts
        .map((a) => `${a.name} (${a.id.replace(/^act_/, "")})`)
        .join(", ");
      throw new Error(
        `Conta ${configured} inacessível com TOKEN_META_ADS.` +
          (list ? ` Contas disponíveis: ${list}` : "")
      );
    }
  }

  const accounts = await fetchAdAccounts();
  const active = accounts.find((a) => a.account_status === 1) ?? accounts[0];
  if (!active) {
    throw new Error(
      "Nenhuma conta de anúncios encontrada. Configure META_AD_ACCOUNT_ID ou conceda ads_read ao token."
    );
  }
  return active.id;
}

export async function fetchAdAccountDetails(accountId: string): Promise<MetaAdAccount> {
  const id = normalizeAdAccountId(accountId);
  const data = await graphFetch<{
    id: string;
    name: string;
    account_status: number;
    currency: string;
  }>(`/${id}?fields=id,name,account_status,currency`);

  return {
    id: data.id,
    name: data.name,
    account_status: data.account_status ?? 0,
    currency: data.currency ?? "BRL",
  };
}

export async function fetchAccountInsights(
  accountId: string,
  datePreset: MetaDatePreset
): Promise<MetaAccountInsights> {
  const id = normalizeAdAccountId(accountId);
  const data = await graphFetch<{ data: Record<string, unknown>[] }>(
    `/${id}/insights?fields=impressions,clicks,spend,ctr,cpc,cpm,reach,frequency,actions,cost_per_action_type&date_preset=${datePreset}`
  );
  const row = data.data?.[0] ?? {};
  const parsed = parseInsightsRow(row as Parameters<typeof parseInsightsRow>[0]);
  const { link_clicks: _lc, cost_per_link_click: _cplc, ...account } = parsed;
  return account;
}

export async function fetchCampaignInsights(
  accountId: string,
  datePreset: MetaDatePreset
): Promise<MetaCampaignPerformance[]> {
  const id = normalizeAdAccountId(accountId);
  const rows = await graphFetchPaginated<{
    campaign_id?: string;
    campaign_name?: string;
    impressions?: string;
    clicks?: string;
    spend?: string;
    ctr?: string;
    reach?: string;
    actions?: { action_type: string; value: string }[];
    cost_per_action_type?: { action_type: string; value: string }[];
  }>(
    `/${id}/insights?level=campaign&fields=campaign_id,campaign_name,impressions,clicks,spend,ctr,reach,actions,cost_per_action_type&date_preset=${datePreset}&limit=100`
  );

  return rows
    .map((row) => ({
      campaign_id: row.campaign_id ?? "",
      campaign_name: row.campaign_name ?? "Sem nome",
      effective_status: "UNKNOWN",
      impressions: parseNumber(row.impressions),
      clicks: parseNumber(row.clicks),
      spend: parseNumber(row.spend),
      ctr: parseNumber(row.ctr),
      reach: parseNumber(row.reach),
      messaging: parseMessagingMetrics(row),
    }))
    .sort((a, b) => b.spend - a.spend);
}

interface AdInsightRow {
  ad_id?: string;
  campaign_id?: string;
  adset_id?: string;
  ad_name?: string;
  campaign_name?: string;
  adset_name?: string;
  impressions?: string;
  clicks?: string;
  spend?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  reach?: string;
  frequency?: string;
  actions?: { action_type: string; value: string }[];
  cost_per_action_type?: { action_type: string; value: string }[];
}

interface AdMetaRow {
  id: string;
  name?: string;
  status?: string;
  effective_status?: string;
  campaign?: { id?: string; name?: string };
  adset?: { id?: string; name?: string };
  creative?: {
    thumbnail_url?: string;
    image_url?: string;
    video_id?: string;
    object_story_spec?: {
      video_data?: { message?: string; title?: string; video_id?: string };
      link_data?: { message?: string; picture?: string };
    };
  };
}

function parseCreativeMedia(creative?: AdMetaRow["creative"]) {
  const videoId =
    creative?.video_id ??
    creative?.object_story_spec?.video_data?.video_id ??
    null;
  const imageUrl =
    creative?.image_url ??
    creative?.object_story_spec?.link_data?.picture ??
    null;
  const message =
    creative?.object_story_spec?.video_data?.message ??
    creative?.object_story_spec?.link_data?.message ??
    null;
  const media_type: MetaAdPerformance["media_type"] = videoId
    ? "video"
    : imageUrl || creative?.thumbnail_url
      ? "image"
      : "none";
  return { videoId, imageUrl, message, media_type };
}

async function fetchAdInsightsRows(
  accountId: string,
  datePreset: MetaDatePreset
): Promise<AdInsightRow[]> {
  const id = normalizeAdAccountId(accountId);
  return graphFetchPaginated<AdInsightRow>(
    `/${id}/insights?level=ad&fields=ad_id,campaign_id,adset_id,ad_name,campaign_name,adset_name,impressions,clicks,spend,ctr,cpc,cpm,reach,frequency,actions,cost_per_action_type&date_preset=${datePreset}&limit=100`
  );
}

async function fetchAdMetadataMap(
  accountId: string,
  options?: { effectiveStatus?: string }
): Promise<Map<string, AdMetaRow>> {
  const id = normalizeAdAccountId(accountId);
  const statusFilter = options?.effectiveStatus
    ? `&effective_status=['${options.effectiveStatus}']`
    : "";
  const creativeFields =
    "thumbnail_url,image_url,video_id,object_story_spec{video_data{message,title,video_id},link_data{message,picture}}";
  const rows = await graphFetchPaginated<AdMetaRow>(
    `/${id}/ads?fields=id,name,status,effective_status,campaign{id,name},adset{id,name},creative{${creativeFields}}&limit=100${statusFilter}`
  );
  return new Map(rows.map((row) => [row.id, row]));
}

export async function fetchAdPerformance(
  accountId: string,
  datePreset: MetaDatePreset,
  options?: { effectiveStatus?: string }
): Promise<MetaAdPerformance[]> {
  const [insightRows, metaById] = await Promise.all([
    fetchAdInsightsRows(accountId, datePreset),
    fetchAdMetadataMap(accountId, options),
  ]);

  const ads: MetaAdPerformance[] = insightRows
    .filter((row) => row.ad_id)
    .map((row) => {
      const meta = metaById.get(row.ad_id!);
      if (options?.effectiveStatus && meta?.effective_status !== options.effectiveStatus) {
        return null;
      }
      const metrics = parseInsightsRow(row);
      const media = parseCreativeMedia(meta?.creative);

      return {
        ad_id: row.ad_id!,
        campaign_id:
          row.campaign_id ?? meta?.campaign?.id ?? `unknown-${row.campaign_name ?? "camp"}`,
        adset_id:
          row.adset_id ?? meta?.adset?.id ?? `unknown-${row.adset_name ?? "adset"}`,
        ad_name: row.ad_name ?? meta?.name ?? "Sem nome",
        campaign_name: row.campaign_name ?? meta?.campaign?.name ?? "—",
        adset_name: row.adset_name ?? meta?.adset?.name ?? "—",
        status: meta?.status ?? "UNKNOWN",
        effective_status: meta?.effective_status ?? "UNKNOWN",
        thumbnail_url:
          meta?.creative?.thumbnail_url ?? media.imageUrl ?? null,
        image_url: media.imageUrl,
        video_id: media.videoId,
        media_type: media.media_type,
        creative_message: media.message,
        impressions: metrics.impressions,
        clicks: metrics.clicks,
        spend: metrics.spend,
        ctr: metrics.ctr,
        cpc: metrics.cpc,
        cpm: metrics.cpm,
        reach: metrics.reach,
        frequency: metrics.frequency,
        link_clicks: metrics.link_clicks,
        cost_per_link_click: metrics.cost_per_link_click,
        messaging: metrics.messaging,
      };
    })
    .filter((ad): ad is MetaAdPerformance => ad !== null)
    .sort((a, b) => b.spend - a.spend || b.impressions - a.impressions);

  // Anúncios ativos sem impressões ainda no período
  if (!options?.effectiveStatus || options.effectiveStatus === "ACTIVE") {
    for (const meta of metaById.values()) {
      if (options?.effectiveStatus && meta.effective_status !== options.effectiveStatus) {
        continue;
      }
      if (ads.some((a) => a.ad_id === meta.id)) continue;
      const media = parseCreativeMedia(meta.creative);
      ads.push({
        ad_id: meta.id,
        campaign_id: meta.campaign?.id ?? `unknown-${meta.campaign?.name ?? "camp"}`,
        adset_id: meta.adset?.id ?? `unknown-${meta.adset?.name ?? "adset"}`,
        ad_name: meta.name ?? "Sem nome",
        campaign_name: meta.campaign?.name ?? "—",
        adset_name: meta.adset?.name ?? "—",
        status: meta.status ?? "UNKNOWN",
        effective_status: meta.effective_status ?? "UNKNOWN",
        thumbnail_url: meta.creative?.thumbnail_url ?? media.imageUrl ?? null,
        image_url: media.imageUrl,
        video_id: media.videoId,
        media_type: media.media_type,
        creative_message: media.message,
        impressions: 0,
        clicks: 0,
        spend: 0,
        ctr: 0,
        cpc: 0,
        cpm: 0,
        reach: 0,
        frequency: 0,
        link_clicks: 0,
        cost_per_link_click: null,
        messaging: { ...EMPTY_MESSAGING },
      });
    }
  }

  return ads.sort((a, b) => b.spend - a.spend || b.impressions - a.impressions);
}

function sortByActiveThenSpend<
  T extends { effective_status: string; spend: number },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aActive = isAdsEntityActive(a.effective_status);
    const bActive = isAdsEntityActive(b.effective_status);
    if (aActive !== bActive) return aActive ? -1 : 1;
    return b.spend - a.spend;
  });
}

async function fetchEntityStatuses(accountId: string): Promise<{
  campaigns: Map<string, string>;
  adsets: Map<string, string>;
}> {
  const id = normalizeAdAccountId(accountId);
  const [campaignRows, adsetRows] = await Promise.all([
    graphFetchPaginated<{ id: string; effective_status?: string }>(
      `/${id}/campaigns?fields=id,effective_status&limit=100`
    ),
    graphFetchPaginated<{ id: string; effective_status?: string }>(
      `/${id}/adsets?fields=id,effective_status&limit=200`
    ),
  ]);
  return {
    campaigns: new Map(
      campaignRows.map((c) => [c.id, c.effective_status ?? "UNKNOWN"])
    ),
    adsets: new Map(
      adsetRows.map((a) => [a.id, a.effective_status ?? "UNKNOWN"])
    ),
  };
}

export interface MetaVideoEmbed {
  video_id: string;
  embed_html: string;
  picture: string | null;
}

/** Busca iframe embed do vídeo do criativo (lazy, no clique do usuário). */
export async function fetchVideoEmbed(videoId: string): Promise<MetaVideoEmbed> {
  const data = await graphFetch<{
    id: string;
    embed_html?: string;
    picture?: string;
    format?: { filter?: string; embed_html?: string; width?: number }[];
  }>(`/${videoId}?fields=embed_html,picture,format`);

  const preferred =
    data.format?.find((f) => f.filter === "480x480") ??
    data.format?.find((f) => (f.width ?? 0) >= 480) ??
    data.format?.[data.format.length - 1];

  const embed_html = preferred?.embed_html ?? data.embed_html;
  if (!embed_html) {
    throw new Error("Vídeo indisponível para reprodução.");
  }

  return {
    video_id: data.id,
    embed_html,
    picture: data.picture ?? null,
  };
}

function sortAds(ads: MetaAdPerformance[], sortBy: keyof MetaAdPerformance = "spend") {
  return [...ads].sort((a, b) => {
    const av = a[sortBy];
    const bv = b[sortBy];
    if (typeof av === "number" && typeof bv === "number") return bv - av;
    return 0;
  });
}

function aggregateMessagingFromAds(ads: MetaAdPerformance[]): MetaMessagingMetrics {
  return {
    conversations_started: ads.reduce((s, a) => s + a.messaging.conversations_started, 0),
    messaging_connections: ads.reduce((s, a) => s + a.messaging.messaging_connections, 0),
    first_replies: ads.reduce((s, a) => s + a.messaging.first_replies, 0),
    conversations_replied: ads.reduce((s, a) => s + a.messaging.conversations_replied, 0),
    cost_per_conversation: null,
  };
}

function aggregateAdSetFromAds(
  adsetId: string,
  adsetName: string,
  campaignId: string,
  effectiveStatus: string,
  ads: MetaAdPerformance[]
): MetaAdSetGroup {
  const spend = ads.reduce((s, a) => s + a.spend, 0);
  const impressions = ads.reduce((s, a) => s + a.impressions, 0);
  const clicks = ads.reduce((s, a) => s + a.clicks, 0);
  return {
    adset_id: adsetId,
    adset_name: adsetName,
    campaign_id: campaignId,
    effective_status: effectiveStatus,
    impressions,
    clicks,
    spend,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    reach: ads.reduce((s, a) => s + a.reach, 0),
    messaging: aggregateMessagingFromAds(ads),
    ads,
  };
}

function buildAdSetGroups(
  campaignId: string,
  ads: MetaAdPerformance[],
  adsetInsights: MetaAdSetPerformance[],
  adsetStatuses: Map<string, string>
): MetaAdSetGroup[] {
  const adsByAdset = new Map<string, MetaAdPerformance[]>();
  for (const ad of ads) {
    const key = ad.adset_id || ad.adset_name;
    const list = adsByAdset.get(key) ?? [];
    list.push(ad);
    adsByAdset.set(key, list);
  }

  const insightById = new Map(adsetInsights.map((a) => [a.adset_id, a]));
  const knownIds = new Set<string>();
  const groups: MetaAdSetGroup[] = [];

  for (const insight of adsetInsights) {
    if (insight.campaign_id && insight.campaign_id !== campaignId) continue;
    const adsetAds = sortAds(adsByAdset.get(insight.adset_id) ?? []);
    knownIds.add(insight.adset_id);
    groups.push({
      ...insight,
      effective_status:
        adsetStatuses.get(insight.adset_id) ?? insight.effective_status ?? "UNKNOWN",
      ads: adsetAds,
    });
  }

  for (const [key, adsetAds] of adsByAdset) {
    if (knownIds.has(key)) continue;
    const first = adsetAds[0];
    groups.push(
      aggregateAdSetFromAds(
        key,
        first?.adset_name ?? "Sem nome",
        campaignId,
        adsetStatuses.get(key) ?? first?.effective_status ?? "UNKNOWN",
        sortAds(adsetAds)
      )
    );
  }

  return sortByActiveThenSpend(groups);
}

export async function fetchAdSetInsights(
  accountId: string,
  datePreset: MetaDatePreset
): Promise<MetaAdSetPerformance[]> {
  const id = normalizeAdAccountId(accountId);
  const rows = await graphFetchPaginated<{
    adset_id?: string;
    adset_name?: string;
    campaign_id?: string;
    impressions?: string;
    clicks?: string;
    spend?: string;
    ctr?: string;
    reach?: string;
    actions?: { action_type: string; value: string }[];
    cost_per_action_type?: { action_type: string; value: string }[];
  }>(
    `/${id}/insights?level=adset&fields=adset_id,adset_name,campaign_id,impressions,clicks,spend,ctr,reach,actions,cost_per_action_type&date_preset=${datePreset}&limit=100`
  );

  return rows
    .map((row) => ({
      adset_id: row.adset_id ?? "",
      adset_name: row.adset_name ?? "Sem nome",
      campaign_id: row.campaign_id ?? "",
      effective_status: "UNKNOWN",
      impressions: parseNumber(row.impressions),
      clicks: parseNumber(row.clicks),
      spend: parseNumber(row.spend),
      ctr: parseNumber(row.ctr),
      reach: parseNumber(row.reach),
      messaging: parseMessagingMetrics(row),
    }))
    .sort((a, b) => b.spend - a.spend);
}

/** Totais da conta considerando só campanhas com effective_status ACTIVE. */
export function aggregateActiveAccountInsights(
  campaigns: MetaCampaignGroup[]
): MetaAccountInsights {
  const active = campaigns.filter((c) => isAdsEntityActive(c.effective_status));
  const spend = active.reduce((s, c) => s + c.spend, 0);
  const impressions = active.reduce((s, c) => s + c.impressions, 0);
  const clicks = active.reduce((s, c) => s + c.clicks, 0);
  const reach = active.reduce((s, c) => s + c.reach, 0);
  const messaging = active.reduce(
    (acc, c) => ({
      conversations_started:
        acc.conversations_started + c.messaging.conversations_started,
      messaging_connections:
        acc.messaging_connections + c.messaging.messaging_connections,
      first_replies: acc.first_replies + c.messaging.first_replies,
      conversations_replied:
        acc.conversations_replied + c.messaging.conversations_replied,
    }),
    {
      conversations_started: 0,
      messaging_connections: 0,
      first_replies: 0,
      conversations_replied: 0,
    }
  );

  return {
    impressions,
    clicks,
    spend,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    reach,
    frequency: reach > 0 ? impressions / reach : 0,
    messaging: {
      ...messaging,
      cost_per_conversation:
        messaging.conversations_started > 0
          ? spend / messaging.conversations_started
          : null,
    },
  };
}

export function buildCampaignGroups(
  campaignInsights: MetaCampaignPerformance[],
  adsetInsights: MetaAdSetPerformance[],
  ads: MetaAdPerformance[],
  statuses: {
    campaigns: Map<string, string>;
    adsets: Map<string, string>;
  }
): MetaCampaignGroup[] {
  const adsByCampaign = new Map<string, MetaAdPerformance[]>();
  for (const ad of ads) {
    const key = ad.campaign_id || ad.campaign_name;
    const list = adsByCampaign.get(key) ?? [];
    list.push(ad);
    adsByCampaign.set(key, list);
  }

  const adsetsByCampaign = new Map<string, MetaAdSetPerformance[]>();
  for (const adset of adsetInsights) {
    const key = adset.campaign_id;
    if (!key) continue;
    const list = adsetsByCampaign.get(key) ?? [];
    list.push(adset);
    adsetsByCampaign.set(key, list);
  }

  const fromInsights: MetaCampaignGroup[] = campaignInsights.map((c) => ({
    ...c,
    effective_status:
      statuses.campaigns.get(c.campaign_id) ?? c.effective_status ?? "UNKNOWN",
    adsets: buildAdSetGroups(
      c.campaign_id,
      adsByCampaign.get(c.campaign_id) ?? [],
      adsetsByCampaign.get(c.campaign_id) ?? [],
      statuses.adsets
    ),
  }));

  const knownCampaignIds = new Set(campaignInsights.map((c) => c.campaign_id));
  for (const [key, campaignAds] of adsByCampaign) {
    if (knownCampaignIds.has(key)) continue;
    const first = campaignAds[0];
    fromInsights.push({
      campaign_id: key,
      campaign_name: first?.campaign_name ?? "Sem nome",
      effective_status: statuses.campaigns.get(key) ?? "UNKNOWN",
      impressions: campaignAds.reduce((s, a) => s + a.impressions, 0),
      clicks: campaignAds.reduce((s, a) => s + a.clicks, 0),
      spend: campaignAds.reduce((s, a) => s + a.spend, 0),
      ctr: 0,
      reach: campaignAds.reduce((s, a) => s + a.reach, 0),
      messaging: aggregateMessagingFromAds(campaignAds),
      adsets: buildAdSetGroups(
        key,
        campaignAds,
        adsetsByCampaign.get(key) ?? [],
        statuses.adsets
      ),
    });
  }

  return sortByActiveThenSpend(fromInsights);
}

export async function fetchMetaAdsDashboard(
  datePreset: MetaDatePreset = "maximum",
  options?: { effectiveStatus?: string }
): Promise<MetaAdsDashboard> {
  const accountId = await resolveAdAccountId();
  const [account, campaignInsights, adsetInsights, ads, statuses] =
    await Promise.all([
      fetchAdAccountDetails(accountId),
      fetchCampaignInsights(accountId, datePreset),
      fetchAdSetInsights(accountId, datePreset),
      fetchAdPerformance(accountId, datePreset, options),
      fetchEntityStatuses(accountId),
    ]);

  const campaigns = buildCampaignGroups(
    campaignInsights,
    adsetInsights,
    ads,
    statuses
  );

  return {
    account,
    datePreset,
    accountInsights: aggregateActiveAccountInsights(campaigns),
    campaigns,
    fetchedAt: new Date().toISOString(),
    dataLatencyNote:
      "Métricas via Meta Ads API — atualização automática a cada 3 min. A Meta costuma ter atraso de ~15 min nos números.",
  };
}

export function formatMetaCurrency(value: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatMetaPercent(value: number): string {
  return `${value.toFixed(2).replace(".", ",")}%`;
}

export interface MetaAdsTokenStatus {
  isValid: boolean;
  type: string | null;
  scopes: string[];
  hasAdsRead: boolean;
  expiresAt: number | null;
  error: string | null;
}

/** Valida TOKEN_META_ADS (ou fallback) via debug_token. */
export async function verifyAdsToken(): Promise<MetaAdsTokenStatus> {
  try {
    const token = getMetaAdsToken();
    const res = await fetch(
      `${GRAPH_BASE}/debug_token?input_token=${encodeURIComponent(token)}`,
      {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const json = await res.json();
    const data = json.data;
    if (!data?.is_valid) {
      return {
        isValid: false,
        type: null,
        scopes: [],
        hasAdsRead: false,
        expiresAt: null,
        error: json.error?.message ?? "Token inválido.",
      };
    }
    const scopes: string[] = data.scopes ?? [];
    return {
      isValid: true,
      type: data.type ?? null,
      scopes,
      hasAdsRead:
        scopes.includes("ads_read") || scopes.includes("ads_management"),
      expiresAt: data.expires_at ?? null,
      error: null,
    };
  } catch (err) {
    return {
      isValid: false,
      type: null,
      scopes: [],
      hasAdsRead: false,
      expiresAt: null,
      error: err instanceof Error ? err.message : "Erro ao validar token.",
    };
  }
}

export interface MetaAdSummary {
  ad_id: string;
  ad_name: string;
  campaign_name: string;
  adset_name: string;
}

/** Busca campanha/conjunto de anúncios pelo ID do anúncio (Graph API). */
export async function fetchMetaAdSummary(adId: string): Promise<MetaAdSummary | null> {
  try {
    const id = adId.trim();
    if (!id) return null;
    const data = await graphFetch<{
      id: string;
      name?: string;
      campaign?: { name?: string };
      adset?: { name?: string };
    }>(`/${id}?fields=id,name,campaign{name},adset{name}`);
    return {
      ad_id: data.id,
      ad_name: data.name ?? "Anúncio",
      campaign_name: data.campaign?.name ?? "",
      adset_name: data.adset?.name ?? "",
    };
  } catch {
    return null;
  }
}
