import { supabase } from "@/utils/supabase/client";

export interface RequestComment {
  id: string;
  request_id: string;
  user_id: string;
  body: string;
  is_alteration: boolean;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  resolved_by_user_name?: string | null;
  created_at: string;
  user_name?: string;
  user_avatar_url?: string | null;
}

export async function fetchCommentsForRequest(
  requestId: string
): Promise<RequestComment[]> {
  const { data, error } = await supabase
    .from("request_comments")
    .select(
      "id, request_id, user_id, body, is_alteration, resolved_at, resolved_by_user_id, created_at"
    )
    .eq("request_id", requestId)
    .order("created_at", { ascending: false });

  if (error) return [];

  const comments = (data ?? []) as RequestComment[];
  if (comments.length === 0) return [];

  // Coleta IDs únicos de autores + resolvedores numa só query
  const authorIds = comments.map((c) => c.user_id);
  const resolverIds = comments
    .filter((c) => c.resolved_by_user_id)
    .map((c) => c.resolved_by_user_id as string);
  const allUserIds = [...new Set([...authorIds, ...resolverIds])];

  const { data: users } = await supabase
    .from("users")
    .select("id, name, avatar_url")
    .in("id", allUserIds);
  const userMap = new Map((users ?? []).map((u) => [u.id, u]));

  return comments.map((c) => ({
    ...c,
    user_name: userMap.get(c.user_id)?.name,
    user_avatar_url: userMap.get(c.user_id)?.avatar_url ?? null,
    resolved_by_user_name: c.resolved_by_user_id
      ? (userMap.get(c.resolved_by_user_id)?.name ?? null)
      : null,
  }));
}

export interface CommentStats {
  commentsCounts: Record<string, number>;
  pendingAlterationsCounts: Record<string, number>;
}

/**
 * Busca contagem de comentários e alterações pendentes em uma única RPC.
 * Substitui fetchCommentsCountByRequest + fetchPendingAlterationsCountByRequest.
 */
export async function fetchCommentStats(
  requestIds: string[]
): Promise<CommentStats> {
  const empty = { commentsCounts: {}, pendingAlterationsCounts: {} };
  if (requestIds.length === 0) return empty;

  const { data, error } = await supabase.rpc("comment_stats", {
    request_ids: requestIds,
  });

  if (error) return empty;

  const commentsCounts: Record<string, number> = {};
  const pendingAlterationsCounts: Record<string, number> = {};
  for (const id of requestIds) {
    commentsCounts[id] = 0;
    pendingAlterationsCounts[id] = 0;
  }
  for (const row of data ?? []) {
    commentsCounts[row.request_id] = Number(row.total_comments);
    pendingAlterationsCounts[row.request_id] = Number(row.pending_alterations);
  }
  return { commentsCounts, pendingAlterationsCounts };
}

/** @deprecated Use fetchCommentStats instead */
export async function fetchCommentsCountByRequest(
  requestIds: string[]
): Promise<Record<string, number>> {
  const { commentsCounts } = await fetchCommentStats(requestIds);
  return commentsCounts;
}

/** @deprecated Use fetchCommentStats instead */
export async function fetchPendingAlterationsCountByRequest(
  requestIds: string[]
): Promise<Record<string, number>> {
  const { pendingAlterationsCounts } = await fetchCommentStats(requestIds);
  return pendingAlterationsCounts;
}

export async function createComment(
  requestId: string,
  userId: string,
  body: string,
  isAlteration: boolean = false
): Promise<{ data: RequestComment | null; error: string | null }> {
  const { data, error } = await supabase
    .from("request_comments")
    .insert({
      request_id: requestId,
      user_id: userId,
      body: body.trim(),
      is_alteration: isAlteration,
    })
    .select(
      "id, request_id, user_id, body, is_alteration, resolved_at, resolved_by_user_id, created_at"
    )
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as RequestComment, error: null };
}

/** Designer marca uma alteração como resolvida */
export async function resolveAlteration(
  commentId: string,
  resolvedByUserId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("request_comments")
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by_user_id: resolvedByUserId,
    })
    .eq("id", commentId)
    .eq("is_alteration", true);

  if (error) return { error: error.message };
  return { error: null };
}

/** Exclui um comentário (uso admin) */
export async function deleteComment(commentId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("request_comments").delete().eq("id", commentId);
  if (error) return { error: error.message };
  return { error: null };
}
