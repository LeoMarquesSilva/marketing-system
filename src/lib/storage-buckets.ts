/** Buckets Supabase Storage (projeto ORQESTRAI / Pro) e helpers de upload. */

import { supabase } from "@/utils/supabase/client";

export const COLLABORATOR_PHOTOS_BUCKET = "MARKETING-SYSTEM-FOTOS";
export const PROJECT_ASSETS_BUCKET = "MARKETING-SYSTEM-PROJETOS";
export const EVENT_FILES_BUCKET = "MARKETING-SYSTEM-EVENTOS";
export const EMAIL_MARKETING_BUCKET = "MARKETING-SYSTEM-EMAILS";

export function publicStorageObjectUrl(
  bucket: string,
  path: string,
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")
): string | null {
  if (!supabaseUrl || !path) return null;
  const clean = path.replace(/^\//, "");
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${clean}`;
}

/** Nome de arquivo seguro para path do Storage (sem acentos/espaços). */
export function sanitizeFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  const clean = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 60) || "arquivo";
  return ext ? `${clean}.${ext}` : clean;
}

export interface StorageUploadResult {
  path: string;
  publicUrl: string;
}

/**
 * Sobe um arquivo para o bucket (client-side, usuário autenticado) e devolve
 * o path + URL pública. Lança Error com mensagem amigável em falha.
 */
export async function uploadToBucket(
  bucket: string,
  path: string,
  file: File
): Promise<StorageUploadResult> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) throw new Error(`Erro ao enviar arquivo: ${error.message}`);

  const publicUrl = publicStorageObjectUrl(bucket, path);
  if (!publicUrl) throw new Error("Não foi possível montar a URL pública do arquivo.");
  return { path, publicUrl };
}

/** Remove um objeto do bucket. Best-effort — não lança em falha. */
export async function removeFromBucket(bucket: string, path: string): Promise<void> {
  try {
    await supabase.storage.from(bucket).remove([path]);
  } catch {
    // best-effort: objeto órfão não impede a operação principal
  }
}

/** Path padronizado para arquivos do módulo de eventos no bucket Pro. */
export function buildEventStoragePath(
  eventId: string,
  folder: string,
  fileName: string
): string {
  const safeFolder = folder.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "") || "geral";
  return `eventos/${eventId}/${safeFolder}/${Date.now()}-${sanitizeFileName(fileName)}`;
}

/** Upload de foto de colaborador para o bucket MARKETING-SYSTEM-FOTOS (Pro). */
export async function uploadCollaboratorPhoto(
  userId: string,
  file: File,
  fileName?: string
): Promise<StorageUploadResult> {
  const storedName = fileName
    ? sanitizeFileName(fileName)
    : `${Date.now()}-${sanitizeFileName(file.name)}`;
  const path = `colaboradores/${userId}/${storedName}`;
  return uploadToBucket(COLLABORATOR_PHOTOS_BUCKET, path, file);
}

/** Upload de arquivo de evento para o bucket MARKETING-SYSTEM-EVENTOS (Pro). */
export async function uploadEventFile(
  eventId: string,
  folder: string,
  file: File
): Promise<StorageUploadResult> {
  const path = buildEventStoragePath(eventId, folder, file.name);
  return uploadToBucket(EVENT_FILES_BUCKET, path, file);
}

/** Upload de imagem de campanha/newsletter (bucket MARKETING-SYSTEM-PROJETOS). */
export async function uploadEmailMarketingImage(
  scopeId: string,
  folder: string,
  file: File
): Promise<StorageUploadResult> {
  const safeScope = scopeId.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "") || "draft";
  const safeFolder = folder.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "") || "geral";
  const path = `email-marketing/${safeScope}/${safeFolder}/${Date.now()}-${sanitizeFileName(file.name)}`;
  return uploadToBucket(PROJECT_ASSETS_BUCKET, path, file);
}

/** Limite do bucket EVENTOS (1 GB). O limite efetivo é o menor entre este e o global do projeto. */
export const REEL_VIDEO_MAX_BYTES = 1024 * 1024 * 1024;

const REEL_VIDEO_TUS_THRESHOLD_BYTES = 6 * 1024 * 1024;

export interface ReelVideoUploadOptions {
  onProgress?: (percent: number) => void;
}

function getSupabaseProjectRef(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match?.[1]) throw new Error("URL do Supabase inválida.");
  return match[1];
}

function formatBytesMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatReelUploadError(err: unknown, fileSize: number): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("mime type") || msg.includes("Invalid")) {
    return `Formato não permitido. Use MP4, MOV ou WebM.`;
  }
  if (msg.includes("maximum allowed size") || msg.includes("exceeded")) {
    return (
      `O vídeo (${formatBytesMb(fileSize)}) excede o limite global do Storage do projeto. ` +
      `Aumente em Supabase → Storage → Settings → "Global file size limit" (recomendado: 500 MB ou 1 GB). ` +
      `O bucket MARKETING-SYSTEM-EVENTOS já aceita até 1 GB.`
    );
  }
  if (msg.includes("Not authenticated") || msg.includes("JWT")) {
    return "Faça login para enviar o vídeo.";
  }
  return `Erro ao enviar vídeo: ${msg}`;
}

async function uploadViaTus(
  bucket: string,
  path: string,
  file: File,
  contentType: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Faça login para enviar o vídeo.");
  }

  const projectRef = getSupabaseProjectRef();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const tus = await import("tus-js-client");

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${session.access_token}`,
        apikey: anonKey,
        "x-upsert": "true",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: bucket,
        objectName: path,
        contentType,
        cacheControl: "3600",
      },
      chunkSize: 6 * 1024 * 1024,
      onError: (error) => reject(error),
      onProgress: (bytesUploaded, bytesTotal) => {
        if (onProgress && bytesTotal > 0) {
          onProgress(Math.round((bytesUploaded / bytesTotal) * 100));
        }
      },
      onSuccess: () => resolve(),
    });

    upload
      .findPreviousUploads()
      .then((previous) => {
        if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
        upload.start();
      })
      .catch(reject);
  });
}

/** Upload de capa de reel (bucket PROJETOS — imagens). */
export async function uploadReelCoverImage(
  requestId: string,
  file: File
): Promise<StorageUploadResult> {
  const safeId = requestId.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "") || "reel";
  const path = `reels/covers/${safeId}/${Date.now()}-${sanitizeFileName(file.name)}`;
  return uploadToBucket(PROJECT_ASSETS_BUCKET, path, file);
}

/** Upload de vídeo de reel (bucket EVENTOS — aceita vídeo; PROJETOS só imagens). */
export async function uploadReelVideo(
  file: File,
  options?: ReelVideoUploadOptions
): Promise<StorageUploadResult> {
  const path = `reels/${Date.now()}-${sanitizeFileName(file.name)}`;
  const contentType = resolveVideoContentType(file);

  if (file.size > REEL_VIDEO_MAX_BYTES) {
    throw new Error(`O vídeo excede o limite de ${formatBytesMb(REEL_VIDEO_MAX_BYTES)}.`);
  }

  try {
    if (file.size > REEL_VIDEO_TUS_THRESHOLD_BYTES) {
      await uploadViaTus(EVENT_FILES_BUCKET, path, file, contentType, options?.onProgress);
    } else {
      const { error } = await supabase.storage.from(EVENT_FILES_BUCKET).upload(path, file, {
        upsert: true,
        contentType,
      });
      if (error) throw error;
    }
  } catch (err) {
    throw new Error(formatReelUploadError(err, file.size));
  }

  const publicUrl = publicStorageObjectUrl(EVENT_FILES_BUCKET, path);
  if (!publicUrl) throw new Error("Não foi possível montar a URL pública do vídeo.");
  return { path, publicUrl };
}

function resolveVideoContentType(file: File): string {
  if (file.type?.startsWith("video/")) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "mp4") return "video/mp4";
  if (ext === "mov") return "video/quicktime";
  if (ext === "webm") return "video/webm";
  if (ext === "m4v") return "video/x-m4v";
  return "video/mp4";
}

export function isSupabaseStorageUrl(url: string, bucket?: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base || !url.startsWith(base)) return false;
  if (bucket) return url.includes(`/storage/v1/object/public/${bucket}/`);
  return url.includes("/storage/v1/object/public/");
}
