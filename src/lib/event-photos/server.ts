import { getServerDb } from "@/lib/users-server";
import { isCollaboratorPhotosManager } from "@/lib/access-control";
import { PhotoHttpError, resolveAppUser } from "@/lib/collaborator-photos/server";
import {
  compareEventPhotoNames,
  parseAlbumDate,
  slugifyAlbumTitle,
  uniqueAlbumSlug,
} from "@/lib/event-photos/domain";
import type {
  EventPhoto,
  EventPhotoAlbum,
  EventPhotoAlbumDetail,
} from "@/lib/event-photos/types";

export { PhotoHttpError, resolveAppUser };

const PHOTOS_BUCKET = "MARKETING-SYSTEM-FOTOS";

type Actor = Awaited<ReturnType<typeof resolveAppUser>>;

const ALBUM_SELECT =
  "id, slug, title, description, event_date, event_id, cover_photo_id, is_published, created_at, " +
  "photos:event_photos!event_photos_album_id_fkey(count), " +
  "cover:event_photos!event_photo_albums_cover_photo_fk(public_url, preview_url)";

const PHOTO_SELECT =
  "id, album_id, storage_path, public_url, preview_path, preview_url, original_filename, width, height, size_bytes, created_at";

interface AlbumRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  event_date: string | null;
  event_id: string | null;
  cover_photo_id: string | null;
  is_published: boolean;
  created_at: string;
  photos: Array<{ count: number }> | null;
  cover: { public_url: string; preview_url: string | null } | null;
}

interface PhotoRow {
  id: string;
  album_id: string;
  storage_path: string;
  public_url: string;
  preview_path: string | null;
  preview_url: string | null;
  original_filename: string | null;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  created_at: string;
}

export function isEventPhotosManager(actor: Actor): boolean {
  return isCollaboratorPhotosManager({
    id: actor.id,
    role: actor.role,
    permissions: actor.permissions,
  });
}

function assertManager(actor: Actor): void {
  if (!isEventPhotosManager(actor)) {
    throw new PhotoHttpError(403, "Só o marketing pode alterar os álbuns de eventos.");
  }
}

function mapAlbum(row: AlbumRow, firstPhoto?: PhotoRow | null): EventPhotoAlbum {
  const cover = row.cover ?? (firstPhoto ? { public_url: firstPhoto.public_url, preview_url: firstPhoto.preview_url } : null);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    eventDate: row.event_date,
    eventId: row.event_id,
    coverPhotoId: row.cover_photo_id,
    coverUrl: cover ? cover.preview_url ?? cover.public_url : null,
    isPublished: row.is_published,
    photoCount: row.photos?.[0]?.count ?? 0,
    createdAt: row.created_at,
  };
}

function mapPhoto(row: PhotoRow): EventPhoto {
  return {
    id: row.id,
    albumId: row.album_id,
    storagePath: row.storage_path,
    publicUrl: row.public_url,
    previewUrl: row.preview_url,
    originalFilename: row.original_filename,
    width: row.width,
    height: row.height,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
  };
}

/** Primeira foto de cada álbum sem capa definida, para não exibir card vazio. */
async function loadFallbackCovers(albumIds: string[]): Promise<Map<string, PhotoRow>> {
  const result = new Map<string, PhotoRow>();
  if (albumIds.length === 0) return result;
  const db = await getServerDb();
  await Promise.all(
    albumIds.map(async (albumId) => {
      const { data } = await db
        .from("event_photos")
        .select(PHOTO_SELECT)
        .eq("album_id", albumId)
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (data) result.set(albumId, data as unknown as PhotoRow);
    })
  );
  return result;
}

export async function listEventAlbums(actor: Actor): Promise<EventPhotoAlbum[]> {
  const db = await getServerDb();
  let query = db
    .from("event_photo_albums")
    .select(ALBUM_SELECT)
    .order("event_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (!isEventPhotosManager(actor)) query = query.eq("is_published", true);
  const { data, error } = await query;
  if (error) throw new PhotoHttpError(500, error.message);
  const rows = (data ?? []) as unknown as AlbumRow[];
  const fallbacks = await loadFallbackCovers(rows.filter((r) => !r.cover).map((r) => r.id));
  return rows.map((row) => mapAlbum(row, fallbacks.get(row.id)));
}

async function loadAlbumRow(column: "id" | "slug", value: string): Promise<AlbumRow | null> {
  const db = await getServerDb();
  const { data, error } = await db
    .from("event_photo_albums")
    .select(ALBUM_SELECT)
    .eq(column, value)
    .maybeSingle();
  if (error) throw new PhotoHttpError(500, error.message);
  return (data as unknown as AlbumRow | null) ?? null;
}

async function requireAlbum(actor: Actor, column: "id" | "slug", value: string): Promise<AlbumRow> {
  const row = await loadAlbumRow(column, value);
  if (!row || (!row.is_published && !isEventPhotosManager(actor))) {
    throw new PhotoHttpError(404, "Álbum não encontrado.");
  }
  return row;
}

/**
 * Ordem do fotógrafo: numeração natural do nome do arquivo ("-2" antes de "-10").
 * O upload é paralelo, então a ordem de chegada (created_at) não é confiável.
 */
function sortPhotoRows(rows: PhotoRow[]): PhotoRow[] {
  return [...rows].sort(
    (a, b) =>
      compareEventPhotoNames(a.original_filename, b.original_filename) ||
      a.created_at.localeCompare(b.created_at)
  );
}

export async function getEventAlbumDetail(actor: Actor, slug: string): Promise<EventPhotoAlbumDetail> {
  const row = await requireAlbum(actor, "slug", slug);
  const db = await getServerDb();
  const { data, error } = await db
    .from("event_photos")
    .select(PHOTO_SELECT)
    .eq("album_id", row.id)
    .order("created_at")
    .order("original_filename");
  if (error) throw new PhotoHttpError(500, error.message);
  const rows = sortPhotoRows((data ?? []) as unknown as PhotoRow[]);
  return { album: mapAlbum(row, rows[0] ?? null), photos: rows.map(mapPhoto) };
}

export async function createEventAlbum(
  actor: Actor,
  input: { title?: unknown; description?: unknown; eventDate?: unknown }
): Promise<EventPhotoAlbum> {
  assertManager(actor);
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) throw new PhotoHttpError(400, "Informe o nome do álbum.");
  if (title.length > 120) throw new PhotoHttpError(400, "Nome muito longo (máx. 120 caracteres).");
  const base = slugifyAlbumTitle(title);
  if (!base) throw new PhotoHttpError(400, "Nome inválido.");
  const description =
    typeof input.description === "string" && input.description.trim() ? input.description.trim() : null;

  const db = await getServerDb();
  const { data: taken, error: takenError } = await db
    .from("event_photo_albums")
    .select("slug")
    .like("slug", `${base}%`);
  if (takenError) throw new PhotoHttpError(500, takenError.message);
  const slug = uniqueAlbumSlug(base, (taken ?? []).map((r) => r.slug as string));

  const { data, error } = await db
    .from("event_photo_albums")
    .insert({
      slug,
      title,
      description,
      event_date: parseAlbumDate(input.eventDate),
      is_published: true,
      created_by: actor.id,
    })
    .select("id")
    .single();
  if (error || !data) throw new PhotoHttpError(500, error?.message ?? "Erro ao criar álbum.");
  const row = await loadAlbumRow("id", data.id as string);
  if (!row) throw new PhotoHttpError(500, "Erro ao carregar álbum criado.");
  return mapAlbum(row);
}

export async function updateEventAlbum(
  actor: Actor,
  albumId: string,
  patch: {
    title?: unknown;
    description?: unknown;
    eventDate?: unknown;
    isPublished?: unknown;
    coverPhotoId?: unknown;
  }
): Promise<EventPhotoAlbum> {
  assertManager(actor);
  await requireAlbum(actor, "id", albumId);
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (patch.title !== undefined) {
    const title = typeof patch.title === "string" ? patch.title.trim() : "";
    if (!title || title.length > 120) throw new PhotoHttpError(400, "Nome do álbum inválido.");
    update.title = title;
  }
  if (patch.description !== undefined) {
    update.description =
      typeof patch.description === "string" && patch.description.trim() ? patch.description.trim() : null;
  }
  if (patch.eventDate !== undefined) update.event_date = parseAlbumDate(patch.eventDate);
  if (patch.isPublished !== undefined) update.is_published = patch.isPublished === true;
  if (patch.coverPhotoId !== undefined) {
    if (patch.coverPhotoId === null) {
      update.cover_photo_id = null;
    } else {
      const db = await getServerDb();
      const { data: photo } = await db
        .from("event_photos")
        .select("id")
        .eq("id", String(patch.coverPhotoId))
        .eq("album_id", albumId)
        .maybeSingle();
      if (!photo) throw new PhotoHttpError(400, "A capa precisa ser uma foto deste álbum.");
      update.cover_photo_id = photo.id;
    }
  }

  const db = await getServerDb();
  const { error } = await db.from("event_photo_albums").update(update).eq("id", albumId);
  if (error) throw new PhotoHttpError(500, error.message);
  const row = await loadAlbumRow("id", albumId);
  if (!row) throw new PhotoHttpError(404, "Álbum não encontrado.");
  return mapAlbum(row);
}

async function removeStorageObjects(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const db = await getServerDb();
  // Storage aceita remoção em lote; fatia para não estourar o payload.
  for (let i = 0; i < paths.length; i += 500) {
    await db.storage.from(PHOTOS_BUCKET).remove(paths.slice(i, i + 500));
  }
}

export async function deleteEventAlbum(actor: Actor, albumId: string): Promise<void> {
  assertManager(actor);
  await requireAlbum(actor, "id", albumId);
  const db = await getServerDb();
  const { data: photos, error: photosError } = await db
    .from("event_photos")
    .select("storage_path, preview_path")
    .eq("album_id", albumId);
  if (photosError) throw new PhotoHttpError(500, photosError.message);

  const { error } = await db.from("event_photo_albums").delete().eq("id", albumId);
  if (error) throw new PhotoHttpError(500, error.message);

  await removeStorageObjects(
    (photos ?? []).flatMap((p) => [p.storage_path as string, p.preview_path as string | null]).filter(
      (p): p is string => Boolean(p)
    )
  );
}

function assertAlbumStoragePath(albumId: string, path: unknown): string {
  if (typeof path !== "string" || !path.startsWith(`eventos/${albumId}/`) || path.includes("..")) {
    throw new PhotoHttpError(400, "Caminho de arquivo inválido para este álbum.");
  }
  return path;
}

function positiveIntOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

export async function registerEventPhoto(
  actor: Actor,
  albumId: string,
  input: {
    storagePath?: unknown;
    publicUrl?: unknown;
    previewPath?: unknown;
    previewUrl?: unknown;
    originalFilename?: unknown;
    width?: unknown;
    height?: unknown;
    sizeBytes?: unknown;
  }
): Promise<EventPhoto> {
  assertManager(actor);
  await requireAlbum(actor, "id", albumId);
  const storagePath = assertAlbumStoragePath(albumId, input.storagePath);
  const previewPath =
    input.previewPath == null ? null : assertAlbumStoragePath(albumId, input.previewPath);
  if (typeof input.publicUrl !== "string" || !input.publicUrl.includes(storagePath)) {
    throw new PhotoHttpError(400, "URL pública inválida.");
  }
  const previewUrl =
    previewPath && typeof input.previewUrl === "string" && input.previewUrl.includes(previewPath)
      ? input.previewUrl
      : null;

  const db = await getServerDb();
  const { data, error } = await db
    .from("event_photos")
    .insert({
      album_id: albumId,
      storage_path: storagePath,
      public_url: input.publicUrl,
      preview_path: previewUrl ? previewPath : null,
      preview_url: previewUrl,
      original_filename:
        typeof input.originalFilename === "string" ? input.originalFilename.slice(0, 200) : null,
      width: positiveIntOrNull(input.width),
      height: positiveIntOrNull(input.height),
      size_bytes: typeof input.sizeBytes === "number" && input.sizeBytes >= 0 ? Math.round(input.sizeBytes) : null,
      uploaded_by: actor.id,
    })
    .select(PHOTO_SELECT)
    .single();
  if (error || !data) {
    if (error?.code === "23505") throw new PhotoHttpError(409, "Esta foto já foi registrada.");
    throw new PhotoHttpError(500, error?.message ?? "Erro ao registrar foto.");
  }
  return mapPhoto(data as unknown as PhotoRow);
}

export async function deleteEventPhotos(actor: Actor, photoIds: unknown): Promise<string[]> {
  assertManager(actor);
  if (!Array.isArray(photoIds) || photoIds.length === 0 || photoIds.length > 500) {
    throw new PhotoHttpError(400, "Selecione entre 1 e 500 fotos.");
  }
  const ids = [...new Set(photoIds.map(String))];
  const db = await getServerDb();
  const { data: photos, error: photosError } = await db
    .from("event_photos")
    .select("id, storage_path, preview_path")
    .in("id", ids);
  if (photosError) throw new PhotoHttpError(500, photosError.message);
  if (!photos?.length) throw new PhotoHttpError(404, "Nenhuma foto encontrada.");

  const found = photos.map((p) => p.id as string);
  const { error } = await db.from("event_photos").delete().in("id", found);
  if (error) throw new PhotoHttpError(500, error.message);

  await removeStorageObjects(
    photos.flatMap((p) => [p.storage_path as string, p.preview_path as string | null]).filter(
      (p): p is string => Boolean(p)
    )
  );
  return found;
}

/** Converte erros das rotas no formato JSON usado pelo módulo de fotos. */
export function eventPhotosErrorResponse(err: unknown, fallback: string): { status: number; error: string } {
  if (err instanceof PhotoHttpError) return { status: err.status, error: err.message };
  const message = err instanceof Error ? err.message : fallback;
  const status = message.includes("Não autenticado") ? 401 : message.includes("inativo") ? 403 : 500;
  return { status, error: message };
}
