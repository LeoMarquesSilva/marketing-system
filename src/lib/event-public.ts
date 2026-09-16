import type { SupabaseClient } from "@supabase/supabase-js";
import { PUBLIC_APP_ORIGIN } from "@/lib/public-origin";
import { supabase } from "@/utils/supabase/client";

export interface PublicEventAttachment {
  id: string;
  title: string;
  url: string;
  fileType: string;
  createdAt: string;
}

export interface PublicEventShare {
  title: string;
  description: string | null;
  eventName: string;
  expiresAt: string | null;
  attachments: PublicEventAttachment[];
}

export interface EventPublicShareSummary {
  token: string;
  title: string;
  description: string | null;
  active: boolean;
  expiresAt: string | null;
  publicUrl: string;
}

export interface EventTrackingLinkSummary {
  id: string;
  campaignSlug: string;
  channel: string;
  label: string;
  destinationUrl: string;
  trackingUrl: string;
  totalClicks: number;
  lastClickedAt: string | null;
}

export interface EventPublicCampaignSummary {
  share: EventPublicShareSummary | null;
  links: EventTrackingLinkSummary[];
}

type PublicShareRpcRow = {
  title?: unknown;
  description?: unknown;
  eventName?: unknown;
  expiresAt?: unknown;
  attachments?: unknown;
};

export function eventShareUrl(token: string): string {
  return `${PUBLIC_APP_ORIGIN}/materiais/${encodeURIComponent(token)}`;
}

export function eventTrackingUrl(campaignSlug: string, channel: string): string {
  return `${PUBLIC_APP_ORIGIN}/r/${encodeURIComponent(campaignSlug)}/${encodeURIComponent(channel)}`;
}

export async function fetchPublicEventShare(
  token: string,
  client?: SupabaseClient
): Promise<PublicEventShare | null> {
  const db = client ?? supabase;
  const { data, error } = await db.rpc("get_event_public_share", { p_token: token });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) return null;

  const row = data as PublicShareRpcRow;
  if (typeof row.title !== "string" || typeof row.eventName !== "string") return null;

  const attachments = Array.isArray(row.attachments)
    ? row.attachments
        .filter(
          (item): item is Record<string, unknown> =>
            !!item && typeof item === "object" && !Array.isArray(item)
        )
        .filter(
          (item) =>
            typeof item.id === "string" &&
            typeof item.title === "string" &&
            typeof item.url === "string" &&
            item.url.startsWith("https://")
        )
        .map((item) => ({
          id: item.id as string,
          title: item.title as string,
          url: item.url as string,
          fileType: typeof item.fileType === "string" ? item.fileType : "arquivo_geral",
          createdAt: typeof item.createdAt === "string" ? item.createdAt : "",
        }))
    : [];

  return {
    title: row.title,
    description: typeof row.description === "string" ? row.description : null,
    eventName: row.eventName,
    expiresAt: typeof row.expiresAt === "string" ? row.expiresAt : null,
    attachments,
  };
}

export async function fetchEventPublicCampaignSummary(
  eventId: string,
  client?: SupabaseClient
): Promise<EventPublicCampaignSummary> {
  const db = client ?? supabase;
  const [shareResult, linksResult] = await Promise.all([
    db
      .from("event_public_shares")
      .select("token, title, description, active, expires_at")
      .eq("event_id", eventId)
      .maybeSingle(),
    db
      .from("event_tracking_links")
      .select("id, campaign_slug, channel, label, destination_url")
      .eq("event_id", eventId)
      .eq("active", true)
      .order("label"),
  ]);

  const linkRows = linksResult.data ?? [];
  const linkIds = linkRows.map((row) => row.id as string);
  const clicksResult =
    linkIds.length > 0
      ? await db
          .from("event_tracking_clicks")
          .select("link_id, clicked_at")
          .in("link_id", linkIds)
      : { data: [], error: null };

  const stats = new Map<string, { count: number; lastClickedAt: string | null }>();
  for (const click of clicksResult.data ?? []) {
    const linkId = click.link_id as string;
    const clickedAt = click.clicked_at as string;
    const current = stats.get(linkId) ?? { count: 0, lastClickedAt: null };
    current.count += 1;
    if (!current.lastClickedAt || clickedAt > current.lastClickedAt) {
      current.lastClickedAt = clickedAt;
    }
    stats.set(linkId, current);
  }

  const shareRow = shareResult.data;
  return {
    share: shareRow
      ? {
          token: shareRow.token as string,
          title: shareRow.title as string,
          description: (shareRow.description as string | null) ?? null,
          active: Boolean(shareRow.active),
          expiresAt: (shareRow.expires_at as string | null) ?? null,
          publicUrl: eventShareUrl(shareRow.token as string),
        }
      : null,
    links: linkRows.map((row) => {
      const linkStats = stats.get(row.id as string);
      return {
        id: row.id as string,
        campaignSlug: row.campaign_slug as string,
        channel: row.channel as string,
        label: row.label as string,
        destinationUrl: row.destination_url as string,
        trackingUrl: eventTrackingUrl(
          row.campaign_slug as string,
          row.channel as string
        ),
        totalClicks: linkStats?.count ?? 0,
        lastClickedAt: linkStats?.lastClickedAt ?? null,
      };
    }),
  };
}
