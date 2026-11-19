/**
 * "Minhas entregas": o que o Marketing concluiu para quem pediu (solicitante),
 * com a arte assinada pelo servidor (o bucket é privado e o advogado não tem
 * acesso direto) e os avisos de conclusão ainda não vistos.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { REQUEST_FILES_BUCKET } from "./domain";
import { REEL_DELIVERIES_BUCKET } from "@/lib/reel-deliveries/domain";

const SIGNED_URL_SECONDS = 60 * 60;

export interface DeliveryArtFile {
  id: string;
  name: string;
  contentType: string | null;
  url: string;
}

export interface MyDelivery {
  id: string;
  title: string;
  requestType: string | null;
  area: string | null;
  concludedAt: string | null;
  completionType: string | null;
  postedAt: string | null;
  /** Link da arte (tarefas antigas, de antes do envio de arquivos). */
  artLink: string | null;
  /** Post publicado no Instagram, quando a tarefa foi ligada ao post. */
  permalink: string | null;
  caption: string | null;
  files: DeliveryArtFile[];
  /** Aviso de conclusão ainda não visto (id do aviso). */
  unseenNoticeId: string | null;
}

type RequestRow = {
  id: string;
  title: string;
  request_type: string | null;
  requesting_area: string | null;
  stage_changed_at: string | null;
  delivered_at: string | null;
  completion_type: string | null;
  posted_at: string | null;
  art_link: string | null;
  ig_media_id: string | null;
  /** Capa de Reels: a imagem fica no bucket dos Reels, não nos arquivos da tarefa. */
  art_image_path: string | null;
};

const REQUEST_COLUMNS =
  "id, title, request_type, requesting_area, stage_changed_at, delivered_at, completion_type, posted_at, art_link, ig_media_id, art_image_path";

/** Tira a tag "[OAB]" e o tipo repetido do título, para mostrar ao advogado. */
export function deliveryTitle(title: string): string {
  return title.replace(/^\s*\[[^\]]{1,24}\]\s*/, "").trim() || title;
}

/** Entregas da pessoa (concluídas, mais recentes primeiro) com a arte pronta para ver. */
export async function listMyDeliveries(
  db: SupabaseClient,
  userId: string,
  options: { limit?: number } = {},
): Promise<MyDelivery[]> {
  const { data: requestData, error } = await db
    .from("marketing_requests")
    .select(REQUEST_COLUMNS)
    .eq("solicitante_id", userId)
    .eq("workflow_stage", "concluido")
    .order("stage_changed_at", { ascending: false, nullsFirst: false })
    .limit(options.limit ?? 60);
  if (error) throw new Error("Não foi possível carregar as suas entregas.");
  const requests = (requestData ?? []) as RequestRow[];
  if (requests.length === 0) return [];
  const ids = requests.map((request) => request.id);
  const mediaIds = requests.map((request) => request.ig_media_id).filter((id): id is string => Boolean(id));

  const [{ data: fileData }, { data: checklistData }, { data: noticeData }, { data: postData }] = await Promise.all([
    db
      .from("marketing_request_files")
      .select("id, request_id, storage_path, file_name, content_type")
      .in("request_id", ids)
      .order("sort_order")
      .order("created_at"),
    db.from("marketing_request_checklist_items").select("request_id, label, content").in("request_id", ids).order("sort_order"),
    db
      .from("marketing_request_notices")
      .select("id, request_id")
      .eq("recipient_id", userId)
      .is("seen_at", null)
      .in("request_id", ids),
    mediaIds.length
      ? db.from("instagram_posts").select("ig_media_id, permalink").in("ig_media_id", mediaIds)
      : Promise.resolve({ data: [] as { ig_media_id: string; permalink: string | null }[] }),
  ]);

  const files = (fileData ?? []) as { id: string; request_id: string; storage_path: string; file_name: string; content_type: string | null }[];
  const { data: signed } = files.length
    ? await db.storage.from(REQUEST_FILES_BUCKET).createSignedUrls(files.map((file) => file.storage_path), SIGNED_URL_SECONDS)
    : { data: [] };
  const signedByPath = new Map((signed ?? []).map((item) => [item.path, item.signedUrl]));
  const filesByRequest = new Map<string, DeliveryArtFile[]>();
  for (const file of files) {
    const url = signedByPath.get(file.storage_path);
    if (!url) continue;
    filesByRequest.set(file.request_id, [
      ...(filesByRequest.get(file.request_id) ?? []),
      { id: file.id, name: file.file_name, contentType: file.content_type, url },
    ]);
  }

  // Capa de Reels: a arte é a imagem da capa (art_image_path), guardada no bucket dos Reels.
  const coverPaths = requests.map((request) => request.art_image_path).filter((path): path is string => Boolean(path));
  const { data: signedCovers } = coverPaths.length
    ? await db.storage.from(REEL_DELIVERIES_BUCKET).createSignedUrls(coverPaths, SIGNED_URL_SECONDS)
    : { data: [] };
  const coverByPath = new Map((signedCovers ?? []).map((item) => [item.path, item.signedUrl]));
  for (const request of requests) {
    const url = request.art_image_path ? coverByPath.get(request.art_image_path) : undefined;
    if (!url || filesByRequest.has(request.id)) continue;
    filesByRequest.set(request.id, [
      { id: `capa-${request.id}`, name: request.art_image_path?.split("/").pop() ?? "Capa", contentType: "image/*", url },
    ]);
  }

  const captions = new Map<string, string>();
  for (const item of (checklistData ?? []) as { request_id: string; label: string; content: string | null }[]) {
    if (/^legenda/i.test(item.label) && item.content?.trim() && !captions.has(item.request_id)) {
      captions.set(item.request_id, item.content.trim());
    }
  }
  const notices = new Map(((noticeData ?? []) as { id: string; request_id: string }[]).map((notice) => [notice.request_id, notice.id]));
  const permalinks = new Map(((postData ?? []) as { ig_media_id: string; permalink: string | null }[]).map((post) => [post.ig_media_id, post.permalink]));

  return requests.map((request) => ({
    id: request.id,
    title: deliveryTitle(request.title),
    requestType: request.request_type,
    area: request.requesting_area,
    concludedAt: request.stage_changed_at ?? request.delivered_at,
    completionType: request.completion_type,
    postedAt: request.posted_at,
    artLink: request.art_link?.trim() || null,
    permalink: request.ig_media_id ? permalinks.get(request.ig_media_id) ?? null : null,
    caption: captions.get(request.id) ?? null,
    files: filesByRequest.get(request.id) ?? [],
    unseenNoticeId: notices.get(request.id) ?? null,
  }));
}

/** Quantos avisos de conclusão a pessoa ainda não viu (para o sino). */
export async function countUnseenDeliveryNotices(db: SupabaseClient, userId: string): Promise<number> {
  const { count } = await db
    .from("marketing_request_notices")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", userId)
    .is("seen_at", null);
  return count ?? 0;
}

/** Marca os avisos como vistos (a pessoa abriu Minhas entregas). */
export async function markDeliveryNoticesSeen(db: SupabaseClient, userId: string, noticeIds?: string[]): Promise<void> {
  let query = db.from("marketing_request_notices").update({ seen_at: new Date().toISOString() }).eq("recipient_id", userId).is("seen_at", null);
  if (noticeIds?.length) query = query.in("id", noticeIds);
  const { error } = await query;
  if (error) throw new Error("Não foi possível marcar os avisos como vistos.");
}
