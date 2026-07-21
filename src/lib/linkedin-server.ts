import "server-only";

import { createClient } from "@supabase/supabase-js";
import { mapInstagramPostRow, type InstagramPost } from "@/lib/instagram-posts";
import { sanitizeInstagramPostForClient } from "@/lib/instagram-thumbnail-client";
import { matchLinkedinPostToInstagram } from "@/lib/linkedin-match";
import type {
  LinkedinDashboardData,
  LinkedinImportRecord,
  LinkedinWorkbookData,
} from "@/lib/linkedin-types";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";

function getServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isMissingLinkedinSchema(error: { code?: string; message?: string } | null): boolean {
  return Boolean(
    error &&
      (error.code === "42P01" ||
        error.code === "PGRST205" ||
        error.message?.includes("linkedin_") ||
        error.message?.includes("schema cache"))
  );
}

function subDays(date: string | null, days: number): string | null {
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() - days);
  return parsed.toISOString();
}

function addDays(date: string | null, days: number): string | null {
  if (!date) return null;
  const parsed = new Date(`${date}T23:59:59.999Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString();
}

async function fetchInstagramCandidates(
  from: string | null,
  to: string | null
): Promise<InstagramPost[]> {
  const supabase = getServiceClient();
  let query = supabase
    .from("instagram_posts")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(600);

  const fromIso = subDays(from, 3);
  const toIso = addDays(to, 3);
  if (fromIso) query = query.gte("published_at", fromIso);
  if (toIso) query = query.lte("published_at", toIso);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapInstagramPostRow(row as Record<string, unknown>));
}

export async function fetchLinkedinDashboardData(): Promise<LinkedinDashboardData> {
  const supabase = getServiceClient();
  const [dailyResult, postsResult, importsResult] = await Promise.all([
    supabase.from("linkedin_daily_metrics").select("*").order("metric_date", { ascending: true }),
    supabase.from("linkedin_posts").select("*").order("published_at", { ascending: false }),
    supabase.from("linkedin_imports").select("*").order("imported_at", { ascending: false }).limit(24),
  ]);

  const firstError = dailyResult.error ?? postsResult.error ?? importsResult.error;
  if (firstError) {
    if (isMissingLinkedinSchema(firstError)) {
      return {
        dailyMetrics: [],
        posts: [],
        imports: [],
        instagramCandidates: [],
        unavailableReason: "A migration do LinkedIn ainda não foi aplicada no Supabase.",
      };
    }
    throw new Error(firstError.message);
  }

  const rawPosts = postsResult.data ?? [];
  const postDates = rawPosts
    .map((post) => (post.published_at as string | null)?.slice(0, 10))
    .filter((date): date is string => Boolean(date))
    .sort();
  const metricDates = (dailyResult.data ?? []).map((row) => row.metric_date as string).sort();
  const allDates = [...postDates, ...metricDates].sort();
  const candidates = await fetchInstagramCandidates(allDates[0] ?? null, allDates.at(-1) ?? null);
  const candidateMap = new Map(candidates.map((post) => [post.id, post]));

  return {
    dailyMetrics: dailyResult.data ?? [],
    posts: rawPosts.map((post) => ({
      ...post,
      instagram_post: post.instagram_post_id && candidateMap.has(post.instagram_post_id)
        ? sanitizeInstagramPostForClient(candidateMap.get(post.instagram_post_id)!)
        : null,
    })),
    imports: (importsResult.data ?? []) as LinkedinImportRecord[],
    instagramCandidates: candidates.map((post) => sanitizeInstagramPostForClient(post)),
    unavailableReason: null,
  } as LinkedinDashboardData;
}

export interface PersistLinkedinImportInput {
  workbook: LinkedinWorkbookData;
  filename: string;
  fileHash: string;
  fileSize: number;
  importedBy: string;
}

export interface PersistLinkedinImportResult {
  importId: string;
  dailyRows: number;
  postRows: number;
  matchedPosts: number;
  duplicate: boolean;
  warnings: string[];
}

export async function persistLinkedinImport({
  workbook,
  filename,
  fileHash,
  fileSize,
  importedBy,
}: PersistLinkedinImportInput): Promise<PersistLinkedinImportResult> {
  const supabase = getServiceClient();
  const { data: existingImport, error: existingImportError } = await supabase
    .from("linkedin_imports")
    .select("*")
    .eq("file_hash", fileHash)
    .maybeSingle();

  if (existingImportError) throw new Error(existingImportError.message);
  if (existingImport?.status === "completed") {
    return {
      importId: existingImport.id as string,
      dailyRows: existingImport.daily_rows as number,
      postRows: existingImport.post_rows as number,
      matchedPosts: existingImport.matched_posts as number,
      duplicate: true,
      warnings: (existingImport.warnings as string[] | null) ?? [],
    };
  }
  if (existingImport?.status === "processing") {
    throw new Error("Este arquivo já está sendo processado.");
  }

  let importId = existingImport?.id as string | undefined;
  if (importId) {
    const { error } = await supabase
      .from("linkedin_imports")
      .update({ status: "processing", warnings: workbook.warnings, imported_at: new Date().toISOString() })
      .eq("id", importId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
      .from("linkedin_imports")
      .insert({
        filename,
        file_hash: fileHash,
        file_size: fileSize,
        status: "processing",
        daily_rows: workbook.dailyMetrics.length,
        post_rows: workbook.posts.length,
        date_from: workbook.dateFrom,
        date_to: workbook.dateTo,
        warnings: workbook.warnings,
        imported_by: importedBy,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    importId = data.id as string;
  }

  try {
    const instagramCandidates = await fetchInstagramCandidates(workbook.dateFrom, workbook.dateTo);
    const urns = workbook.posts.map((post) => post.linkedin_urn);
    const { data: existingPosts, error: existingPostsError } = await supabase
      .from("linkedin_posts")
      .select("linkedin_urn, instagram_post_id, match_confidence, match_strategy")
      .in("linkedin_urn", urns);
    if (existingPostsError) throw new Error(existingPostsError.message);

    const existingPostMap = new Map(
      (existingPosts ?? []).map((post) => [post.linkedin_urn as string, post])
    );
    const usedInstagramIds = new Set<string>();
    let matchedPosts = 0;

    const postRows = workbook.posts.map((post) => {
      const existing = existingPostMap.get(post.linkedin_urn);
      const preservesManualUnlink = existing?.match_strategy === "manual_unlinked";
      const preservedInstagramId = preservesManualUnlink
        ? null
        : (existing?.instagram_post_id as string | null | undefined) ?? null;
      const autoMatch = preservedInstagramId || preservesManualUnlink
        ? null
        : matchLinkedinPostToInstagram(post, instagramCandidates, usedInstagramIds);
      const instagramPostId = preservedInstagramId ?? autoMatch?.instagramPostId ?? null;

      if (instagramPostId) {
        usedInstagramIds.add(instagramPostId);
        matchedPosts += 1;
      }

      return {
        ...post,
        instagram_post_id: instagramPostId,
        match_confidence: preservedInstagramId
          ? (existing?.match_confidence as number | null) ?? 1
          : autoMatch?.confidence ?? null,
        match_strategy: preservesManualUnlink
          ? "manual_unlinked"
          : preservedInstagramId
            ? (existing?.match_strategy as string | null) ?? "preserved"
            : autoMatch?.strategy ?? null,
        latest_import_id: importId,
        synced_at: new Date().toISOString(),
      };
    });

    const dailyRows = workbook.dailyMetrics.map((row) => ({
      ...row,
      source_import_id: importId,
      updated_at: new Date().toISOString(),
    }));
    const { error: dailyError } = await supabase
      .from("linkedin_daily_metrics")
      .upsert(dailyRows, { onConflict: "metric_date" });
    if (dailyError) throw new Error(dailyError.message);

    const { data: persistedPosts, error: postsError } = await supabase
      .from("linkedin_posts")
      .upsert(postRows, { onConflict: "linkedin_urn" })
      .select("id, linkedin_urn");
    if (postsError) throw new Error(postsError.message);

    const idByUrn = new Map(
      (persistedPosts ?? []).map((post) => [post.linkedin_urn as string, post.id as string])
    );
    const snapshots = workbook.posts.flatMap((post) => {
      const postId = idByUrn.get(post.linkedin_urn);
      if (!postId) return [];
      return [{
        linkedin_post_id: postId,
        import_id: importId,
        snapshot_date: new Date().toISOString().slice(0, 10),
        impressions: post.impressions,
        views: post.views,
        clicks: post.clicks,
        ctr: post.ctr,
        likes: post.likes,
        comments: post.comments,
        shares: post.shares,
        followers: post.followers,
        engagement_rate: post.engagement_rate,
      }];
    });
    if (snapshots.length > 0) {
      const { error: snapshotsError } = await supabase
        .from("linkedin_post_snapshots")
        .upsert(snapshots, { onConflict: "linkedin_post_id,import_id" });
      if (snapshotsError) throw new Error(snapshotsError.message);
    }

    const { error: completedError } = await supabase
      .from("linkedin_imports")
      .update({
        status: "completed",
        daily_rows: workbook.dailyMetrics.length,
        post_rows: workbook.posts.length,
        matched_posts: matchedPosts,
        date_from: workbook.dateFrom,
        date_to: workbook.dateTo,
        warnings: workbook.warnings,
      })
      .eq("id", importId);
    if (completedError) throw new Error(completedError.message);

    return {
      importId,
      dailyRows: workbook.dailyMetrics.length,
      postRows: workbook.posts.length,
      matchedPosts,
      duplicate: false,
      warnings: workbook.warnings,
    };
  } catch (error) {
    await supabase.from("linkedin_imports").update({ status: "failed" }).eq("id", importId);
    throw error;
  }
}

export async function updateLinkedinInstagramLink(
  linkedinPostId: string,
  instagramPostId: string | null
): Promise<void> {
  const supabase = getServiceClient();
  if (instagramPostId) {
    const { data: instagramPost, error: instagramError } = await supabase
      .from("instagram_posts")
      .select("id")
      .eq("id", instagramPostId)
      .maybeSingle();
    if (instagramError) throw new Error(instagramError.message);
    if (!instagramPost) throw new Error("Post do Instagram não encontrado.");
  }

  const { error } = await supabase
    .from("linkedin_posts")
    .update({
      instagram_post_id: instagramPostId,
      match_confidence: instagramPostId ? 1 : null,
      match_strategy: instagramPostId ? "manual" : "manual_unlinked",
      synced_at: new Date().toISOString(),
    })
    .eq("id", linkedinPostId);
  if (error) throw new Error(error.message);
}
