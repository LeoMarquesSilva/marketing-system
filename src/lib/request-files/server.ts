import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getTitleTag } from "@/lib/planner-title-tag";
import { REQUEST_FILES_BUCKET, isImageContentType } from "./domain";

const SIGNED_URL_SECONDS = 6 * 60 * 60;

/** A arte só aparece no link depois que a designer manda para aprovação. */
const STAGES_WITH_FILES = new Set(["revisao", "revisao_autor", "revisado", "pronto_envio", "concluido"]);
const READY_STAGES = new Set(["revisado", "pronto_envio", "concluido"]);
const POSTED_COMPLETIONS = new Set(["postagem_feita", "postagem_externa"]);

export type DeliveryPieceStatus = "postada" | "pronta" | "aprovacao" | "producao";

export interface DeliveryFile {
  id: string;
  name: string;
  contentType: string | null;
  sizeBytes: number | null;
  isImage: boolean;
  previewUrl: string;
  downloadUrl: string;
}

export interface DeliveryPiece {
  id: string;
  code: string | null;
  format: string | null;
  name: string;
  deadline: string | null;
  deadlineTime: string | null;
  status: DeliveryPieceStatus;
  caption: string | null;
  files: DeliveryFile[];
}

export interface PlannerTagDelivery {
  tag: string;
  pieces: DeliveryPiece[];
}

type RequestRow = {
  id: string;
  title: string;
  deadline: string | null;
  deadline_time: string | null;
  workflow_stage: string | null;
  completion_type: string | null;
};

type FileRow = {
  id: string;
  request_id: string;
  storage_path: string;
  file_name: string;
  content_type: string | null;
  size_bytes: number | null;
};

function pieceStatus(row: RequestRow): DeliveryPieceStatus {
  const stage = row.workflow_stage ?? "tarefas";
  if (stage === "concluido" && POSTED_COMPLETIONS.has(row.completion_type ?? "")) return "postada";
  if (READY_STAGES.has(stage)) return "pronta";
  if (stage === "revisao" || stage === "revisao_autor") return "aprovacao";
  return "producao";
}

/** "F01 Feed — Convite oficial" → código F01, formato Feed, nome Convite oficial. */
function splitPieceTitle(rest: string): { code: string | null; format: string | null; name: string } {
  const [head, ...nameParts] = rest.split(" — ");
  const name = nameParts.join(" — ").trim();
  if (!name) return { code: null, format: null, name: rest.trim() };
  const [code, ...formatParts] = head.trim().split(/\s+/);
  return { code: code || null, format: formatParts.join(" ") || null, name };
}

function comparePieces(a: DeliveryPiece, b: DeliveryPiece): number {
  if (a.deadline !== b.deadline) {
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return a.deadline.localeCompare(b.deadline);
  }
  return (a.code ?? "").localeCompare(b.code ?? "", "pt-BR", { numeric: true });
}

/**
 * Página de download (`/entregas/[tag]`, com login): peças da tag com arte,
 * status e legenda. Lê com a sessão de quem está logado (RLS + URLs assinadas).
 */
export async function fetchPlannerTagDelivery(db: SupabaseClient, tag: string): Promise<PlannerTagDelivery> {
  const likeTag = tag.replace(/[%_\\]/g, (c) => `\\${c}`);
  const { data: requestData } = await db
    .from("marketing_requests")
    .select("id, title, deadline, deadline_time, workflow_stage, completion_type")
    .ilike("title", `%[${likeTag}]%`);
  const requests = ((requestData ?? []) as RequestRow[]).filter((r) => getTitleTag(r.title)?.tag === tag);
  const ids = requests.map((r) => r.id);

  const [{ data: fileData }, { data: captionData }] = ids.length
    ? await Promise.all([
        db
          .from("marketing_request_files")
          .select("id, request_id, storage_path, file_name, content_type, size_bytes")
          .in("request_id", ids)
          .order("sort_order")
          .order("created_at"),
        db
          .from("marketing_request_checklist_items")
          .select("request_id, content")
          .in("request_id", ids)
          .ilike("label", "legenda%"),
      ])
    : [{ data: [] }, { data: [] }];

  const visibleStages = new Map(requests.map((r) => [r.id, STAGES_WITH_FILES.has(r.workflow_stage ?? "")]));
  const files = ((fileData ?? []) as FileRow[]).filter((f) => visibleStages.get(f.request_id));
  const { data: signed } = files.length
    ? await db.storage.from(REQUEST_FILES_BUCKET).createSignedUrls(files.map((f) => f.storage_path), SIGNED_URL_SECONDS)
    : { data: [] };
  const signedByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  const filesByRequest = new Map<string, DeliveryFile[]>();
  for (const file of files) {
    const url = signedByPath.get(file.storage_path);
    if (!url) continue;
    const list = filesByRequest.get(file.request_id) ?? [];
    list.push({
      id: file.id,
      name: file.file_name,
      contentType: file.content_type,
      sizeBytes: file.size_bytes,
      isImage: isImageContentType(file.content_type),
      previewUrl: url,
      downloadUrl: `${url}&download=${encodeURIComponent(file.file_name)}`,
    });
    filesByRequest.set(file.request_id, list);
  }

  const captions = new Map<string, string>();
  for (const item of (captionData ?? []) as { request_id: string; content: string | null }[]) {
    if (item.content?.trim() && !captions.has(item.request_id)) captions.set(item.request_id, item.content.trim());
  }

  const pieces = requests
    .map((row): DeliveryPiece => {
      const { code, format, name } = splitPieceTitle(getTitleTag(row.title)?.rest || row.title);
      return {
        id: row.id,
        code,
        format,
        name,
        deadline: row.deadline,
        deadlineTime: row.deadline_time,
        status: pieceStatus(row),
        caption: captions.get(row.id) ?? null,
        files: filesByRequest.get(row.id) ?? [],
      };
    })
    .sort(comparePieces);

  return { tag, pieces };
}
