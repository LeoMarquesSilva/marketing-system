import { supabase } from "@/utils/supabase/client";
import { sanitizeFileName } from "@/lib/storage-buckets";
import {
  REQUEST_FILES_BUCKET,
  REQUEST_FILE_MAX_BYTES,
  requestFileContentType,
  type RequestFile,
} from "./domain";

const FILE_COLUMNS = "id, request_id, storage_path, file_name, content_type, size_bytes, sort_order, created_at";
const PREVIEW_URL_SECONDS = 60 * 60;

type FileRow = {
  id: string;
  request_id: string;
  storage_path: string;
  file_name: string;
  content_type: string | null;
  size_bytes: number | null;
  sort_order: number;
  created_at: string;
};

function toRequestFile(row: FileRow): RequestFile {
  return {
    id: row.id,
    requestId: row.request_id,
    storagePath: row.storage_path,
    fileName: row.file_name,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

export async function fetchRequestFiles(requestId: string): Promise<RequestFile[]> {
  const { data, error } = await supabase
    .from("marketing_request_files")
    .select(FILE_COLUMNS)
    .eq("request_id", requestId)
    .order("sort_order")
    .order("created_at");
  if (error) throw new Error("Não foi possível carregar os arquivos da arte.");
  return (data as FileRow[]).map(toRequestFile);
}

/** Sobe um arquivo da arte para o bucket privado e registra na solicitação. */
export async function uploadRequestFile(
  requestId: string,
  file: File,
  options: { sortOrder: number; uploadedById?: string | null }
): Promise<RequestFile> {
  const contentType = requestFileContentType(file.name, file.type);
  if (!contentType) throw new Error(`"${file.name}": use imagem (JPG, PNG, WebP, GIF), PDF, vídeo (MP4, MOV) ou ZIP.`);
  if (file.size > REQUEST_FILE_MAX_BYTES) throw new Error(`"${file.name}" passa de 500 MB.`);

  const path = `requests/${requestId}/${Date.now()}-${sanitizeFileName(file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from(REQUEST_FILES_BUCKET)
    .upload(path, file, { upsert: false, contentType });
  if (uploadError) throw new Error(`Não foi possível enviar "${file.name}": ${uploadError.message}`);

  const { data, error } = await supabase
    .from("marketing_request_files")
    .insert({
      request_id: requestId,
      storage_path: path,
      file_name: file.name,
      content_type: contentType,
      size_bytes: file.size,
      sort_order: options.sortOrder,
      uploaded_by_id: options.uploadedById ?? null,
    })
    .select(FILE_COLUMNS)
    .single();
  if (error || !data) {
    await supabase.storage.from(REQUEST_FILES_BUCKET).remove([path]);
    throw new Error(`Não foi possível registrar "${file.name}" na solicitação.`);
  }
  return toRequestFile(data as FileRow);
}

export async function deleteRequestFile(file: RequestFile): Promise<void> {
  const { error } = await supabase.from("marketing_request_files").delete().eq("id", file.id);
  if (error) throw new Error(`Não foi possível remover "${file.fileName}".`);
  // Best-effort: objeto órfão no bucket não impede a remoção na tarefa.
  await supabase.storage.from(REQUEST_FILES_BUCKET).remove([file.storagePath]);
}

/** URLs assinadas (1 h) para pré-visualizar e baixar dentro do sistema. */
export async function signRequestFileUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data } = await supabase.storage
    .from(REQUEST_FILES_BUCKET)
    .createSignedUrls(paths, PREVIEW_URL_SECONDS);
  const urls: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
  }
  return urls;
}
