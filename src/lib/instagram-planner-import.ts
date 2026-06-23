import { createClient } from "@supabase/supabase-js";
import type { InstagramPost } from "@/lib/instagram-posts";
import { captionToPostTitle, POST_REQUEST_TYPE } from "@/lib/planner-posts";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function getServiceClient() {
  if (!supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

function resolveArea(post: InstagramPost): string {
  if (post.areas?.length) return post.areas[0];
  if (post.area?.trim()) return post.area.trim();
  return "Geral";
}

function resolveSolicitante(post: InstagramPost): {
  solicitante_id: string | null;
  solicitante: string | null;
  nome_advogado: string | null;
} {
  const primary = post.solicitantes?.[0];
  if (primary) {
    return {
      solicitante_id: primary.id,
      solicitante: primary.name,
      nome_advogado: primary.name,
    };
  }
  if (post.solicitante_id) {
    return {
      solicitante_id: post.solicitante_id,
      solicitante: post.solicitante,
      nome_advogado: post.solicitante,
    };
  }
  return { solicitante_id: null, solicitante: null, nome_advogado: null };
}

export async function fetchImportedIgMediaIds(): Promise<Set<string>> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("marketing_requests")
    .select("ig_media_id")
    .not("ig_media_id", "is", null);

  if (error) throw new Error(error.message);
  return new Set(
    (data ?? [])
      .map((row) => row.ig_media_id as string | null)
      .filter((id): id is string => Boolean(id))
  );
}

export async function importInstagramPostsToPlanner(
  posts: InstagramPost[],
  importedBy?: { id?: string | null; name?: string | null }
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  if (posts.length === 0) return { imported: 0, skipped: 0, errors: [] };

  const supabase = getServiceClient();
  const existingIds = await fetchImportedIgMediaIds();
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const post of posts) {
    if (!post.ig_media_id) {
      skipped++;
      continue;
    }
    if (existingIds.has(post.ig_media_id)) {
      skipped++;
      continue;
    }
    if (!post.published_at) {
      errors.push(`Post ${post.ig_media_id}: sem data de publicação.`);
      skipped++;
      continue;
    }

    const solicitante = resolveSolicitante(post);
    const title = captionToPostTitle(post.caption);
    const description = post.caption?.trim() || null;

    const { error } = await supabase.from("marketing_requests").insert({
      title,
      description,
      requesting_area: resolveArea(post),
      request_type: POST_REQUEST_TYPE,
      status: "completed",
      workflow_stage: "concluido",
      completion_type: "postagem_feita",
      posted_at: post.published_at,
      art_link: post.permalink ?? post.media_url ?? null,
      link: post.permalink ?? null,
      ig_media_id: post.ig_media_id,
      delivered_at: post.published_at,
      requested_at: post.published_at,
      stage_changed_at: post.published_at,
      ...solicitante,
      created_by: importedBy?.name ?? null,
      created_by_id: importedBy?.id ?? null,
    });

    if (error) {
      errors.push(`Post ${post.ig_media_id}: ${error.message}`);
      skipped++;
      continue;
    }

    existingIds.add(post.ig_media_id);
    imported++;
  }

  return { imported, skipped, errors };
}
