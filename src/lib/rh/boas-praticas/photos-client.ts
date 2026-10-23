"use client";

import { supabase } from "@/utils/supabase/client";
import { readExifTakenAt } from "./photo-exif";
import {
  FEEDBACK_PHOTO_MAX_BYTES,
  FEEDBACK_PHOTOS_BUCKET,
  type FeedbackPhoto,
  type FeedbackPhotoType,
} from "./types";

const MAX_SIDE = 1920;

async function call<T>(input: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const response = await fetch(input, {
    method: init?.method ?? "GET",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Não foi possível concluir a operação.");
  return data;
}

interface PreparedPhoto {
  blob: Blob;
  contentType: FeedbackPhotoType;
  width: number | null;
  height: number | null;
  takenAt: string | null;
}

/**
 * Corrige a rotação, reduz para no máximo 1920 px e regrava em WebP. Regravar
 * descarta os metadados (inclusive GPS); a data da foto é lida antes, do original.
 */
export async function prepareFeedbackPhoto(file: File): Promise<PreparedPhoto> {
  const takenAt = file.type === "image/jpeg" ? readExifTakenAt(await file.arrayBuffer()) : null;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(`Não deu para ler "${file.name}". Envie a foto em JPG, PNG ou WebP.`);
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("O navegador não conseguiu preparar a foto.");
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
  if (!blob) throw new Error("O navegador não conseguiu preparar a foto.");
  // Navegador sem WebP devolve PNG: grava como veio.
  const contentType: FeedbackPhotoType = blob.type === "image/webp" ? "image/webp" : blob.type === "image/jpeg" ? "image/jpeg" : "image/png";
  if (blob.size > FEEDBACK_PHOTO_MAX_BYTES) throw new Error(`"${file.name}" passa de 10 MB mesmo reduzida.`);
  return { blob, contentType, width, height, takenAt };
}

export async function uploadFeedbackPhoto(feedbackId: string, file: File): Promise<FeedbackPhoto> {
  const photo = await prepareFeedbackPhoto(file);
  const upload = await call<{ path: string; token: string }>(`/api/rh/boas-praticas/${feedbackId}/fotos/upload`, {
    method: "POST",
    body: { content_type: photo.contentType, size_bytes: photo.blob.size },
  });
  const { error } = await supabase.storage
    .from(FEEDBACK_PHOTOS_BUCKET)
    .uploadToSignedUrl(upload.path, upload.token, photo.blob, { contentType: photo.contentType });
  if (error) throw new Error(`Não foi possível enviar "${file.name}": ${error.message}`);
  const { item } = await call<{ item: FeedbackPhoto }>(`/api/rh/boas-praticas/${feedbackId}/fotos`, {
    method: "POST",
    body: {
      storage_path: upload.path,
      file_name: file.name,
      content_type: photo.contentType,
      size_bytes: photo.blob.size,
      width: photo.width,
      height: photo.height,
      taken_at: photo.takenAt,
    },
  });
  return item;
}

export async function listFeedbackPhotos(feedbackId: string): Promise<FeedbackPhoto[]> {
  const { items } = await call<{ items: FeedbackPhoto[] }>(`/api/rh/boas-praticas/${feedbackId}/fotos`);
  return items;
}

export async function deleteFeedbackPhoto(feedbackId: string, photoId: string): Promise<void> {
  await call(`/api/rh/boas-praticas/${feedbackId}/fotos/${photoId}`, { method: "DELETE" });
}

/** Imagens coladas (Ctrl+V) ou arrastadas: só arquivos de imagem. */
export function imageFilesFrom(list: FileList | DataTransferItemList | null | undefined): File[] {
  if (!list) return [];
  const files: File[] = [];
  for (const entry of Array.from(list as ArrayLike<File | DataTransferItem>)) {
    const file = entry instanceof File ? entry : entry.kind === "file" ? entry.getAsFile() : null;
    if (file && file.type.startsWith("image/")) files.push(file);
  }
  return files;
}
