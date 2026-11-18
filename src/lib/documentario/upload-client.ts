/**
 * Envio de arquivos ao acervo do documentário (bucket privado), direto do navegador:
 * a política do Storage só aceita quem tem a chave de edição. Arquivos grandes
 * (vídeos) usam upload retomável; a miniatura é gerada aqui para a galeria abrir leve.
 */

import { supabase } from "@/utils/supabase/client";
import { sanitizeFileName } from "@/lib/storage-buckets";
import { DOC_BUCKET } from "./types";

const TUS_THRESHOLD_BYTES = 6 * 1024 * 1024;
const THUMB_MAX = 720;

export interface ArchivePreview {
  thumb: Blob | null;
  width: number | null;
  height: number | null;
}

function canvasToWebp(source: CanvasImageSource, width: number, height: number): Promise<Blob | null> {
  const scale = Math.min(1, THUMB_MAX / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) return Promise.resolve(null);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/webp", 0.8));
}

async function imagePreview(file: File): Promise<ArchivePreview> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    return { thumb: await canvasToWebp(bitmap, bitmap.width, bitmap.height), width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

function videoPreview(file: File): Promise<ArchivePreview> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;
    const finish = (result: ArchivePreview) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
      resolve(result);
    };
    const timeout = window.setTimeout(() => finish({ thumb: null, width: null, height: null }), 12000);
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.onerror = () => finish({ thumb: null, width: null, height: null });
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      video.currentTime = Math.min(1, duration * 0.1);
    };
    video.onseeked = async () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) return finish({ thumb: null, width: null, height: null });
      finish({ thumb: await canvasToWebp(video, width, height), width, height });
    };
    video.src = url;
  });
}

/** Miniatura e dimensões; formatos que o navegador não abre (ex.: HEIC) voltam sem miniatura. */
export async function makeArchivePreview(file: File, kind: string): Promise<ArchivePreview> {
  try {
    if (kind === "foto") return await imagePreview(file);
    if (kind === "video") return await videoPreview(file);
  } catch {
    // sem miniatura: a galeria mostra o ícone do tipo
  }
  return { thumb: null, width: null, height: null };
}

function projectRef(): string {
  const match = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match?.[1]) throw new Error("URL do Supabase inválida.");
  return match[1];
}

async function uploadResumable(path: string, file: File, contentType: string, onProgress: (percent: number) => void): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sua sessão expirou. Entre de novo para enviar.");
  const tus = await import("tus-js-client");
  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `https://${projectRef()}.storage.supabase.co/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${session.access_token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
        "x-upsert": "false",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: { bucketName: DOC_BUCKET, objectName: path, contentType, cacheControl: "3600" },
      chunkSize: 6 * 1024 * 1024,
      onError: reject,
      onProgress: (sent, total) => total > 0 && onProgress(Math.round((sent / total) * 100)),
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

function friendlyError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (/row-level security|403|Unauthorized|not allowed/i.test(message)) return new Error("Sem permissão para enviar ao acervo.");
  if (/maximum allowed size|exceeded|413/i.test(message)) return new Error("Arquivo maior que o limite (2 GB).");
  return new Error(`Falha no envio: ${message}`);
}

export interface UploadedArchiveFile {
  storage_path: string;
  thumb_path: string | null;
}

/** Sobe o original (e a miniatura, se houver) para acervo/<projeto>/. */
export async function uploadArchiveFile(
  projectId: string,
  file: File,
  preview: ArchivePreview,
  onProgress: (percent: number) => void,
): Promise<UploadedArchiveFile> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const safe = sanitizeFileName(file.name);
  const storagePath = `acervo/${projectId}/${stamp}-${safe}`;
  const contentType = file.type || "application/octet-stream";
  try {
    if (file.size > TUS_THRESHOLD_BYTES) {
      await uploadResumable(storagePath, file, contentType, onProgress);
    } else {
      const { error } = await supabase.storage.from(DOC_BUCKET).upload(storagePath, file, { contentType, upsert: false });
      if (error) throw error;
      onProgress(100);
    }
  } catch (error) {
    throw friendlyError(error);
  }
  let thumbPath: string | null = null;
  if (preview.thumb) {
    const candidate = `acervo/${projectId}/miniaturas/${stamp}.webp`;
    const { error } = await supabase.storage.from(DOC_BUCKET).upload(candidate, preview.thumb, { contentType: "image/webp", upsert: false });
    if (!error) thumbPath = candidate;
  }
  return { storage_path: storagePath, thumb_path: thumbPath };
}
