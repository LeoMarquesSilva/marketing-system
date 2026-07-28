/**
 * Agrega conteúdo profissional recente sem duplicar publicações-fonte.
 *
 * Fontes: Instagram, LinkedIn e Reel Studio. Overrides só ocultam itens
 * na projeção — nunca alteram a publicação original.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfileContentItem, ProfileContentSourceType } from "@/lib/profiles/types";

const TITLE_MAX_LENGTH = 120;
const DEFAULT_FETCH_CAP = 40;

export type InstagramContentRow = {
  id: string;
  caption?: string | null;
  thumbnail_url?: string | null;
  media_url?: string | null;
  permalink?: string | null;
  published_at?: string | null;
  solicitante_id?: string | null;
  solicitantes?: unknown;
};

export type LinkedinContentRow = {
  id: string;
  caption?: string | null;
  permalink?: string | null;
  published_at?: string | null;
  byline?: string | null;
  instagram_post_id?: string | null;
};

export type ReelStudioContentRow = {
  id: string;
  title?: string | null;
  cover_image_url?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export function contentItemKey(
  sourceType: ProfileContentSourceType,
  sourceId: string
): string {
  return `${sourceType}:${sourceId}`;
}

export function truncateContentTitle(
  value: string | null | undefined,
  maxLength = TITLE_MAX_LENGTH
): string {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "Sem título";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function parseSolicitantes(value: unknown): Array<{ id: string; name?: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const id = "id" in entry ? String((entry as { id: unknown }).id ?? "") : "";
      if (!id) return null;
      const name =
        "name" in entry && typeof (entry as { name: unknown }).name === "string"
          ? (entry as { name: string }).name
          : undefined;
      return { id, name };
    })
    .filter((entry): entry is { id: string; name?: string } => Boolean(entry));
}

export function instagramRowBelongsToUser(
  row: InstagramContentRow,
  userId: string
): boolean {
  if (!userId) return false;
  if (row.solicitante_id === userId) return true;
  return parseSolicitantes(row.solicitantes).some((entry) => entry.id === userId);
}

export function normalizeInstagramRow(row: InstagramContentRow): ProfileContentItem {
  return {
    sourceType: "instagram",
    sourceId: row.id,
    key: contentItemKey("instagram", row.id),
    title: truncateContentTitle(row.caption),
    imageUrl: row.thumbnail_url || row.media_url || null,
    url: row.permalink || null,
    publishedAt: row.published_at ?? null,
  };
}

export function linkedinBylineMatches(
  byline: string | null | undefined,
  userName: string
): boolean {
  const needle = userName.trim().toLowerCase();
  if (!needle) return false;
  return (byline ?? "").trim().toLowerCase() === needle;
}

export function linkedinRowBelongsToUser(
  row: LinkedinContentRow,
  userName: string,
  ownedInstagramIds: Set<string>
): boolean {
  if (row.instagram_post_id && ownedInstagramIds.has(row.instagram_post_id)) {
    return true;
  }
  return linkedinBylineMatches(row.byline, userName);
}

export function normalizeLinkedinRow(
  row: LinkedinContentRow,
  instagramImageById: Map<string, string | null> = new Map()
): ProfileContentItem {
  const igId = row.instagram_post_id ?? null;
  const imageUrl = igId ? (instagramImageById.get(igId) ?? null) : null;
  return {
    sourceType: "linkedin",
    sourceId: row.id,
    key: contentItemKey("linkedin", row.id),
    title: truncateContentTitle(row.caption),
    imageUrl,
    url: row.permalink || null,
    publishedAt: row.published_at ?? null,
  };
}

export function normalizeReelStudioRow(row: ReelStudioContentRow): ProfileContentItem {
  return {
    sourceType: "reel_studio",
    sourceId: row.id,
    key: contentItemKey("reel_studio", row.id),
    title: truncateContentTitle(row.title),
    imageUrl: row.cover_image_url || null,
    url: null,
    publishedAt: row.updated_at || row.created_at || null,
  };
}

/**
 * Remove Instagram quando um LinkedIn aponta para o mesmo post (`instagram_post_id`).
 * Preferimos manter o item LinkedIn.
 */
export function dedupeLinkedInstagram(
  items: ProfileContentItem[],
  linkedinInstagramIds: Set<string>
): ProfileContentItem[] {
  if (linkedinInstagramIds.size === 0) return items;
  return items.filter((item) => {
    if (item.sourceType !== "instagram") return true;
    return !linkedinInstagramIds.has(item.sourceId);
  });
}

function publishedAtTime(value: string | null): number {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

/**
 * Agrega, deduplica, remove ocultos e limita — puro, para testes e para o fetch.
 */
export function aggregateProfileContentItems(
  items: ProfileContentItem[],
  options: {
    hiddenKeys: Set<string>;
    limit: number;
    linkedinInstagramIds?: Set<string>;
  }
): ProfileContentItem[] {
  const deduped = dedupeLinkedInstagram(items, options.linkedinInstagramIds ?? new Set());
  const visible = deduped.filter((item) => !options.hiddenKeys.has(item.key));
  return visible
    .slice()
    .sort((a, b) => publishedAtTime(b.publishedAt) - publishedAtTime(a.publishedAt))
    .slice(0, Math.max(0, options.limit));
}

async function queryInstagramRows(
  supabase: SupabaseClient,
  userId: string
): Promise<InstagramContentRow[]> {
  // solicitante_id direto + jsonb contains em solicitantes[{id}].
  const settled = await Promise.allSettled([
    supabase
      .from("instagram_posts")
      .select("id, caption, thumbnail_url, media_url, permalink, published_at, solicitante_id, solicitantes")
      .eq("solicitante_id", userId)
      .order("published_at", { ascending: false })
      .limit(DEFAULT_FETCH_CAP),
    supabase
      .from("instagram_posts")
      .select("id, caption, thumbnail_url, media_url, permalink, published_at, solicitante_id, solicitantes")
      .contains("solicitantes", [{ id: userId }])
      .order("published_at", { ascending: false })
      .limit(DEFAULT_FETCH_CAP),
  ]);

  const rows: InstagramContentRow[] = [];
  let sawSuccess = false;
  let lastError: { message?: string } | null = null;

  for (const result of settled) {
    if (result.status === "rejected") {
      lastError = { message: String(result.reason) };
      continue;
    }
    if (result.value.error) {
      lastError = result.value.error;
      continue;
    }
    sawSuccess = true;
    rows.push(...((result.value.data ?? []) as InstagramContentRow[]));
  }

  // Só propaga falha se nenhum dos dois caminhos retornou dados.
  if (!sawSuccess) {
    throw lastError ?? new Error("Falha ao consultar Instagram.");
  }

  const map = new Map<string, InstagramContentRow>();
  for (const row of rows) {
    if (instagramRowBelongsToUser(row, userId)) {
      map.set(row.id, row);
    }
  }
  return [...map.values()];
}

async function queryLinkedinRows(
  supabase: SupabaseClient,
  userName: string,
  ownedInstagramIds: string[]
): Promise<LinkedinContentRow[]> {
  const filters: string[] = [];
  const trimmed = userName.trim();
  if (trimmed) {
    // byline exato (case-insensitive) via ilike sem curingas; aspas para espaços.
    const escaped = trimmed.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    filters.push(`byline.ilike."${escaped}"`);
  }
  if (ownedInstagramIds.length > 0) {
    filters.push(`instagram_post_id.in.(${ownedInstagramIds.join(",")})`);
  }
  if (filters.length === 0) return [];

  const { data, error } = await supabase
    .from("linkedin_posts")
    .select("id, caption, permalink, published_at, byline, instagram_post_id")
    .or(filters.join(","))
    .order("published_at", { ascending: false })
    .limit(DEFAULT_FETCH_CAP);

  if (error) throw error;
  return (data ?? []) as LinkedinContentRow[];
}

async function queryReelStudioRows(
  supabase: SupabaseClient,
  userId: string
): Promise<ReelStudioContentRow[]> {
  const { data, error } = await supabase
    .from("reel_studio_items")
    .select("id, title, cover_image_url, updated_at, created_at, reel_studio_assignees!inner(user_id)")
    .eq("reel_studio_assignees.user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(DEFAULT_FETCH_CAP);

  if (error) throw error;
  return (data ?? []) as ReelStudioContentRow[];
}

/**
 * Lista conteúdos recentes associados ao colaborador.
 * Uma fonte que falha não impede as demais (`Promise.allSettled`).
 */
export async function listRecentProfessionalContent(
  supabase: SupabaseClient,
  input: {
    userId: string;
    userName: string;
    hiddenKeys: Set<string>;
    limit: number;
  }
): Promise<ProfileContentItem[]> {
  const igResult = await Promise.allSettled([queryInstagramRows(supabase, input.userId)]);
  const instagramRows =
    igResult[0].status === "fulfilled" ? igResult[0].value : ([] as InstagramContentRow[]);

  const ownedInstagramIds = new Set(instagramRows.map((row) => row.id));
  const instagramImageById = new Map(
    instagramRows.map((row) => [row.id, row.thumbnail_url || row.media_url || null] as const)
  );

  const [linkedinSettled, reelSettled] = await Promise.allSettled([
    queryLinkedinRows(supabase, input.userName, [...ownedInstagramIds]),
    queryReelStudioRows(supabase, input.userId),
  ]);

  const linkedinRows =
    linkedinSettled.status === "fulfilled" ? linkedinSettled.value : ([] as LinkedinContentRow[]);
  const reelRows =
    reelSettled.status === "fulfilled" ? reelSettled.value : ([] as ReelStudioContentRow[]);

  const linkedinOwned = linkedinRows.filter((row) =>
    linkedinRowBelongsToUser(row, input.userName, ownedInstagramIds)
  );
  const linkedinInstagramIds = new Set(
    linkedinOwned
      .map((row) => row.instagram_post_id)
      .filter((id): id is string => Boolean(id))
  );

  const items: ProfileContentItem[] = [
    ...instagramRows.map(normalizeInstagramRow),
    ...linkedinOwned.map((row) => normalizeLinkedinRow(row, instagramImageById)),
    ...reelRows.map(normalizeReelStudioRow),
  ];

  return aggregateProfileContentItems(items, {
    hiddenKeys: input.hiddenKeys,
    limit: input.limit,
    linkedinInstagramIds,
  });
}
