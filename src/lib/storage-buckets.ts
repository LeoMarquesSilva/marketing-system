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
  file: File
): Promise<StorageUploadResult> {
  const path = `colaboradores/${userId}/${Date.now()}-${sanitizeFileName(file.name)}`;
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

export function isSupabaseStorageUrl(url: string, bucket?: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base || !url.startsWith(base)) return false;
  if (bucket) return url.includes(`/storage/v1/object/public/${bucket}/`);
  return url.includes("/storage/v1/object/public/");
}
