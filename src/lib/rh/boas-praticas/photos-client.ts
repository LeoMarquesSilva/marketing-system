"use client";

import { supabase } from "@/utils/supabase/client";
import { readExifTakenAt } from "./photo-exif";
import { isVideoFile, videoProblem, videoTypeOf } from "./media";
import {
  FEEDBACK_PHOTO_MAX_BYTES,
  FEEDBACK_PHOTOS_BUCKET,
  type FeedbackPhoto,
  type FeedbackPhotoType,
  type FeedbackVideoType,
} from "./types";

const MAX_SIDE = 1920;
const POSTER_SIDE = 640;

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

/* -------------------------------------------------------------- vídeo */

interface PreparedVideo {
  contentType: FeedbackVideoType;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  poster: Blob | null;
}

function waitFor(video: HTMLVideoElement, event: "loadedmetadata" | "seeked", ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const finish = (ok: boolean) => {
      clearTimeout(timer);
      video.removeEventListener(event, onEvent);
      video.removeEventListener("error", onError);
      resolve(ok);
    };
    const onEvent = () => finish(true);
    const onError = () => finish(false);
    const timer = setTimeout(() => finish(false), ms);
    video.addEventListener(event, onEvent);
    video.addEventListener("error", onError);
  });
}

/**
 * Lê duração e tamanho do vídeo e tira a miniatura (WebP, até 640 px) de um
 * quadro do começo. O vídeo sobe como veio; se o navegador não abrir o formato
 * (ex.: HEVC sem suporte), sobe sem miniatura e sem duração.
 */
export async function prepareFeedbackVideo(file: File): Promise<PreparedVideo> {
  const problem = videoProblem(file);
  if (problem) throw new Error(problem);
  const contentType = videoTypeOf(file) as FeedbackVideoType;
  const source = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = source;
  try {
    if (!(await waitFor(video, "loadedmetadata", 15_000))) {
      return { contentType, durationSeconds: null, width: null, height: null, poster: null };
    }
    const durationSeconds = Number.isFinite(video.duration) ? Math.round(video.duration * 100) / 100 : null;
    const width = video.videoWidth || null;
    const height = video.videoHeight || null;
    let poster: Blob | null = null;
    if (width && height) {
      video.currentTime = Math.min(1, (durationSeconds ?? 4) / 4);
      if (await waitFor(video, "seeked", 10_000)) {
        const scale = Math.min(1, POSTER_SIDE / Math.max(width, height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.8));
        poster = blob?.type === "image/webp" ? blob : null;
      }
    }
    return { contentType, durationSeconds, width, height, poster };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(source);
  }
}

/** PUT direto na URL assinada do bucket, com progresso (o vídeo não passa pelo servidor do sistema). */
function putSigned(path: string, token: string, body: Blob, contentType: string, onProgress?: (fraction: number) => void) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const target = `${base}/storage/v1/object/upload/sign/${FEEDBACK_PHOTOS_BUCKET}/${path}?token=${encodeURIComponent(token)}`;
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", target);
    request.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "");
    request.setRequestHeader("content-type", contentType);
    request.setRequestHeader("cache-control", "max-age=3600");
    request.setRequestHeader("x-upsert", "false");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) return resolve();
      let message = `erro ${request.status}`;
      try {
        message = (JSON.parse(request.responseText) as { message?: string }).message ?? message;
      } catch {
        // resposta sem JSON: fica o código
      }
      reject(new Error(message));
    };
    request.onerror = () => reject(new Error("a conexão caiu durante o envio"));
    request.send(body);
  });
}

type UploadTicket = { path: string; token: string; poster: { path: string; token: string } | null };

async function uploadFeedbackVideo(feedbackId: string, file: File, onProgress?: (fraction: number) => void): Promise<FeedbackPhoto> {
  const video = await prepareFeedbackVideo(file);
  const upload = await call<UploadTicket>(`/api/rh/boas-praticas/${feedbackId}/fotos/upload`, {
    method: "POST",
    body: { content_type: video.contentType, size_bytes: file.size, poster: Boolean(video.poster) },
  });
  try {
    await putSigned(upload.path, upload.token, file, video.contentType, onProgress);
  } catch (cause) {
    throw new Error(`Não foi possível enviar "${file.name}": ${cause instanceof Error ? cause.message : "erro no envio"}.`);
  }
  let posterPath: string | null = null;
  if (upload.poster && video.poster) {
    // Sem miniatura o vídeo continua valendo: a galeria mostra o ícone de vídeo.
    const { error } = await supabase.storage
      .from(FEEDBACK_PHOTOS_BUCKET)
      .uploadToSignedUrl(upload.poster.path, upload.poster.token, video.poster, { contentType: "image/webp" });
    if (!error) posterPath = upload.poster.path;
  }
  const { item } = await call<{ item: FeedbackPhoto }>(`/api/rh/boas-praticas/${feedbackId}/fotos`, {
    method: "POST",
    body: {
      storage_path: upload.path,
      file_name: file.name,
      content_type: video.contentType,
      size_bytes: file.size,
      width: video.width,
      height: video.height,
      taken_at: null,
      duration_seconds: video.durationSeconds,
      poster_path: posterPath,
    },
  });
  return item;
}

/* -------------------------------------------------------------- envio */

/** Envia a foto (reduzida, sem GPS) ou o vídeo (como veio, com progresso). */
export async function uploadFeedbackPhoto(
  feedbackId: string,
  file: File,
  onProgress?: (fraction: number) => void
): Promise<FeedbackPhoto> {
  if (isVideoFile(file)) return uploadFeedbackVideo(feedbackId, file, onProgress);
  const photo = await prepareFeedbackPhoto(file);
  const upload = await call<UploadTicket>(`/api/rh/boas-praticas/${feedbackId}/fotos/upload`, {
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

/** Arquivos colados (Ctrl+V), arrastados ou escolhidos: só imagens e vídeos. */
export function mediaFilesFrom(list: FileList | DataTransferItemList | null | undefined): File[] {
  if (!list) return [];
  const files: File[] = [];
  for (const entry of Array.from(list as ArrayLike<File | DataTransferItem>)) {
    const file = entry instanceof File ? entry : entry.kind === "file" ? entry.getAsFile() : null;
    if (file && (file.type.startsWith("image/") || isVideoFile(file))) files.push(file);
  }
  return files;
}
