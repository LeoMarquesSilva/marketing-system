import { uploadToBucket, COLLABORATOR_PHOTOS_BUCKET, sanitizeFileName } from "@/lib/storage-buckets";
import { previewDimensions } from "@/lib/event-photos/domain";
import {
  FACE_CONSENT_VERSION,
  matchFacesToPeople,
  type FaceDescriptor,
  type FaceMatch,
  type FaceReferenceSet,
} from "@/lib/event-photos/faces";
import type {
  EventPhoto,
  EventPhotoAlbum,
  EventPhotoAlbumDetail,
  FaceStatus,
  ScanQueueAlbum,
} from "@/lib/event-photos/types";

async function parseError(res: Response, fallback: string): Promise<never> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  throw new Error(data.error || fallback);
}

async function jsonRequest<T>(url: string, init: RequestInit, fallback: string): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    ...init,
    headers: init.body ? { "Content-Type": "application/json", ...init.headers } : init.headers,
  });
  if (!res.ok) await parseError(res, fallback);
  return (await res.json()) as T;
}

export function fetchEventAlbums(): Promise<{
  albums: EventPhotoAlbum[];
  myCounts: Record<string, number>;
  canManage: boolean;
}> {
  return jsonRequest("/api/event-photos/albums", {}, "Erro ao carregar álbuns.");
}

export function fetchEventAlbum(
  slug: string
): Promise<EventPhotoAlbumDetail & { myPhotoIds: string[]; canManage: boolean }> {
  return jsonRequest(
    `/api/event-photos/albums/by-slug/${encodeURIComponent(slug)}`,
    {},
    "Erro ao carregar álbum."
  );
}

export async function createEventAlbum(input: {
  title: string;
  description?: string;
  eventDate?: string;
}): Promise<EventPhotoAlbum> {
  const data = await jsonRequest<{ album: EventPhotoAlbum }>(
    "/api/event-photos/albums",
    { method: "POST", body: JSON.stringify(input) },
    "Erro ao criar álbum."
  );
  return data.album;
}

export async function updateEventAlbum(
  albumId: string,
  patch: {
    title?: string;
    description?: string | null;
    eventDate?: string | null;
    isPublished?: boolean;
    coverPhotoId?: string | null;
  }
): Promise<EventPhotoAlbum> {
  const data = await jsonRequest<{ album: EventPhotoAlbum }>(
    `/api/event-photos/albums/${albumId}`,
    { method: "PATCH", body: JSON.stringify(patch) },
    "Erro ao atualizar álbum."
  );
  return data.album;
}

export async function deleteEventAlbum(albumId: string): Promise<void> {
  await jsonRequest(`/api/event-photos/albums/${albumId}`, { method: "DELETE" }, "Erro ao apagar álbum.");
}

export async function deleteEventPhotos(photoIds: string[]): Promise<string[]> {
  const data = await jsonRequest<{ deletedIds: string[] }>(
    "/api/event-photos/photos",
    { method: "DELETE", body: JSON.stringify({ photoIds }) },
    "Erro ao apagar fotos."
  );
  return data.deletedIds;
}

interface PreviewResult {
  blob: Blob | null;
  canvas: HTMLCanvasElement | null;
  width: number | null;
  height: number | null;
}

/** Gera prévia WEBP leve no navegador (a grade carrega rápido e o original fica para download). */
async function buildPreview(file: File): Promise<PreviewResult> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const size = previewDimensions(bitmap.width, bitmap.height);
    const original = { width: bitmap.width, height: bitmap.height };
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return { blob: null, canvas: null, ...original };
    }
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.82)
    );
    return { blob, canvas, ...original };
  } catch {
    return { blob: null, canvas: null, width: null, height: null };
  }
}

/** Compara os rostos da prévia com quem consentiu. Falha aqui nunca impede o upload. */
async function matchFacesOnCanvas(
  canvas: HTMLCanvasElement | null,
  people: FaceReferenceSet[] | null | undefined
): Promise<{ matches: FaceMatch[]; failed: boolean }> {
  if (!canvas || !people?.length) return { matches: [], failed: false };
  try {
    const { faceDescriptorsIn } = await import("@/lib/event-photos/face-engine");
    const faces = await faceDescriptorsIn(canvas);
    return { matches: matchFacesToPeople(faces, people), failed: false };
  } catch (err) {
    console.warn("[event-photos] reconhecimento facial indisponível neste upload", err);
    return { matches: [], failed: true };
  }
}

export interface EventPhotoUploadResult {
  photo: EventPhoto;
  recognized: number;
  faceCheckFailed: boolean;
}

/**
 * Sobe original + prévia no Storage e registra a foto no álbum.
 * Com `people` (referências de quem consentiu), marca quem aparece na foto.
 */
export async function uploadEventPhoto(
  albumId: string,
  file: File,
  people?: FaceReferenceSet[] | null
): Promise<EventPhotoUploadResult> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const safeName = sanitizeFileName(file.name);
  const basePath = `eventos/${albumId}`;
  const original = await uploadToBucket(
    COLLABORATOR_PHOTOS_BUCKET,
    `${basePath}/originais/${stamp}-${safeName}`,
    file
  );

  const preview = await buildPreview(file);
  let previewUpload: { path: string; publicUrl: string } | null = null;
  if (preview.blob) {
    const previewFile = new File([preview.blob], `${stamp}.webp`, { type: "image/webp" });
    previewUpload = await uploadToBucket(
      COLLABORATOR_PHOTOS_BUCKET,
      `${basePath}/previas/${stamp}.webp`,
      previewFile
    ).catch(() => null);
  }
  const faces = await matchFacesOnCanvas(preview.canvas, people);

  const data = await jsonRequest<{ photo: EventPhoto }>(
    `/api/event-photos/albums/${albumId}/photos`,
    {
      method: "POST",
      body: JSON.stringify({
        storagePath: original.path,
        publicUrl: original.publicUrl,
        previewPath: previewUpload?.path ?? null,
        previewUrl: previewUpload?.publicUrl ?? null,
        originalFilename: file.name,
        width: preview.width,
        height: preview.height,
        sizeBytes: file.size,
        faceMatches: faces.matches,
      }),
    },
    "Erro ao registrar foto."
  );
  return { photo: data.photo, recognized: faces.matches.length, faceCheckFailed: faces.failed };
}

// ---------- Reconhecimento facial (opt-in) ----------

export async function fetchFaceStatus(): Promise<FaceStatus> {
  const data = await jsonRequest<{ status: FaceStatus }>(
    "/api/event-photos/faces/consent",
    {},
    "Erro ao consultar reconhecimento facial."
  );
  return data.status;
}

export async function grantFaceConsent(
  references: Array<{ sourcePhotoId: string | null; descriptor: FaceDescriptor }>
): Promise<FaceStatus> {
  const data = await jsonRequest<{ status: FaceStatus }>(
    "/api/event-photos/faces/consent",
    {
      method: "POST",
      body: JSON.stringify({ consentVersion: FACE_CONSENT_VERSION, references }),
    },
    "Erro ao ativar reconhecimento facial."
  );
  return data.status;
}

export async function revokeFaceConsent(): Promise<FaceStatus> {
  const data = await jsonRequest<{ status: FaceStatus }>(
    "/api/event-photos/faces/consent",
    { method: "DELETE" },
    "Erro ao desativar reconhecimento facial."
  );
  return data.status;
}

export function fetchFaceScanQueue(): Promise<{ albums: ScanQueueAlbum[]; descriptors: FaceDescriptor[] }> {
  return jsonRequest("/api/event-photos/faces/scan", {}, "Erro ao preparar a busca.");
}

export async function saveFaceScan(
  albumId: string,
  matches: Array<{ photoId: string; distance: number }>
): Promise<void> {
  await jsonRequest(
    "/api/event-photos/faces/scan",
    { method: "POST", body: JSON.stringify({ albumId, matches }) },
    "Erro ao salvar a busca."
  );
}

/** Referências de quem consentiu (só marketing), usadas no upload. */
export async function fetchFaceReferences(): Promise<FaceReferenceSet[]> {
  const data = await jsonRequest<{ people: FaceReferenceSet[] }>(
    "/api/event-photos/faces/references",
    {},
    "Erro ao carregar referências faciais."
  );
  return data.people;
}

export async function rejectFaceMatch(photoId: string): Promise<void> {
  await jsonRequest(
    "/api/event-photos/faces/reject",
    { method: "POST", body: JSON.stringify({ photoId }) },
    "Erro ao remover a marcação."
  );
}

/** URL pública com `?download=` para o Storage devolver como anexo. */
export function eventPhotoDownloadUrl(photo: EventPhoto, filename: string): string {
  const separator = photo.publicUrl.includes("?") ? "&" : "?";
  return `${photo.publicUrl}${separator}download=${encodeURIComponent(filename)}`;
}
