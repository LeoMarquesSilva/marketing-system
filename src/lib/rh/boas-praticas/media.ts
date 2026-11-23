/** Regras de fotos e vídeos das ocorrências que não dependem do navegador. */

import { FEEDBACK_VIDEO_MAX_BYTES, FEEDBACK_VIDEO_TYPES, type FeedbackVideoType } from "./types";

const VIDEO_TYPE_BY_EXTENSION: Record<string, FeedbackVideoType> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

/** Tipo do vídeo pelo navegador ou, quando ele não informa (comum no .mov no Windows), pela extensão. */
export function videoTypeOf(file: { name: string; type: string }): FeedbackVideoType | null {
  if ((FEEDBACK_VIDEO_TYPES as readonly string[]).includes(file.type)) return file.type as FeedbackVideoType;
  if (file.type && !file.type.startsWith("video/") && file.type !== "application/octet-stream") return null;
  return VIDEO_TYPE_BY_EXTENSION[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? null;
}

export function isVideoFile(file: { name: string; type: string }): boolean {
  return file.type.startsWith("video/") || videoTypeOf(file) !== null;
}

/** Motivo para recusar o vídeo antes de entrar na lista (formato ou tamanho), ou null. */
export function videoProblem(file: { name: string; type: string; size: number }): string | null {
  if (!videoTypeOf(file)) return `"${file.name}" não é um vídeo em MP4, MOV ou WebM.`;
  if (file.size > FEEDBACK_VIDEO_MAX_BYTES) return `"${file.name}" passa de 200 MB. Grave um vídeo mais curto.`;
  return null;
}

/** 7 → "0:07"; 75.4 → "1:15"; 3725 → "1:02:05". */
export function formatDuration(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return null;
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = String(total % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
}

/** 12_582_912 → "12 MB"; 850_000 → "0,8 MB". */
export function formatMegabytes(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes >= 10 ? Math.round(megabytes) : megabytes.toFixed(1).replace(".", ",")} MB`;
}
