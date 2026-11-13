import "server-only";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getServerDb } from "@/lib/users-server";
import {
  PhotoHttpError,
  isEventPhotosManager,
  type resolveAppUser,
} from "@/lib/event-photos/server";
import { compareEventPhotoNames, eventPhotoDownloadName } from "@/lib/event-photos/domain";
import {
  galleryPath,
  galleryUrl,
  isOwnStorageUrl,
  isShareToken,
  normalizeShareLabel,
  shareExpiresAt,
  shareImageUrl,
  shareStatus,
} from "@/lib/event-photos/share";
import type { EventPhotoShare, PublicGallery, PublicGalleryPhoto } from "@/lib/event-photos/types";

type Actor = Awaited<ReturnType<typeof resolveAppUser>>;

const SHARE_SELECT =
  "id, album_id, token, label, logo_url, allow_download, expires_at, revoked_at, open_count, last_opened_at, created_at, " +
  "creator:users!event_photo_album_shares_created_by_fkey(name)";

interface ShareRow {
  id: string;
  album_id: string;
  token: string;
  label: string;
  logo_url: string | null;
  allow_download: boolean;
  expires_at: string | null;
  revoked_at: string | null;
  open_count: number;
  last_opened_at: string | null;
  created_at: string;
  creator: { name: string | null } | null;
}

function supabaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
}

function mapShare(row: ShareRow): EventPhotoShare {
  return {
    id: row.id,
    albumId: row.album_id,
    token: row.token,
    url: galleryUrl(row.token),
    label: row.label,
    logoUrl: row.logo_url,
    allowDownload: row.allow_download,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    openCount: row.open_count,
    lastOpenedAt: row.last_opened_at,
    createdAt: row.created_at,
    createdByName: row.creator?.name ?? null,
  };
}

function assertManager(actor: Actor): void {
  if (!isEventPhotosManager(actor)) {
    throw new PhotoHttpError(403, "Só o marketing compartilha álbuns de eventos.");
  }
}

async function requireAlbumId(albumId: string): Promise<void> {
  const db = await getServerDb();
  const { data, error } = await db.from("event_photo_albums").select("id").eq("id", albumId).maybeSingle();
  if (error) throw new PhotoHttpError(500, error.message);
  if (!data) throw new PhotoHttpError(404, "Álbum não encontrado.");
}

export async function listAlbumShares(actor: Actor, albumId: string): Promise<EventPhotoShare[]> {
  assertManager(actor);
  const db = await getServerDb();
  const { data, error } = await db
    .from("event_photo_album_shares")
    .select(SHARE_SELECT)
    .eq("album_id", albumId)
    .order("created_at", { ascending: false });
  if (error) throw new PhotoHttpError(500, error.message);
  return ((data ?? []) as unknown as ShareRow[]).map(mapShare);
}

export async function createAlbumShare(
  actor: Actor,
  albumId: string,
  input: { label?: unknown; logoUrl?: unknown; allowDownload?: unknown; expiresInDays?: unknown }
): Promise<EventPhotoShare> {
  assertManager(actor);
  await requireAlbumId(albumId);
  const label = normalizeShareLabel(input.label);
  if (!label) throw new PhotoHttpError(400, "Informe para quem é o link (até 120 caracteres).");
  const logoUrl = isOwnStorageUrl(input.logoUrl, supabaseUrl()) ? input.logoUrl : null;

  const db = await getServerDb();
  const { data, error } = await db
    .from("event_photo_album_shares")
    .insert({
      album_id: albumId,
      token: randomBytes(16).toString("base64url"),
      label,
      logo_url: logoUrl,
      allow_download: input.allowDownload !== false,
      expires_at: shareExpiresAt(input.expiresInDays),
      created_by: actor.id,
    })
    .select(SHARE_SELECT)
    .single();
  if (error || !data) throw new PhotoHttpError(500, error?.message ?? "Erro ao criar o link.");
  return mapShare(data as unknown as ShareRow);
}

/** Revogar ou liberar/bloquear o download. A página pública é refeita na hora. */
export async function updateAlbumShare(
  actor: Actor,
  shareId: string,
  patch: { revoke?: unknown; allowDownload?: unknown }
): Promise<EventPhotoShare> {
  assertManager(actor);
  const update: Record<string, unknown> = {};
  if (patch.revoke === true) update.revoked_at = new Date().toISOString();
  if (typeof patch.allowDownload === "boolean") update.allow_download = patch.allowDownload;
  if (Object.keys(update).length === 0) throw new PhotoHttpError(400, "Nada para alterar.");

  const db = await getServerDb();
  const { data, error } = await db
    .from("event_photo_album_shares")
    .update(update)
    .eq("id", shareId)
    .select(SHARE_SELECT)
    .maybeSingle();
  if (error) throw new PhotoHttpError(500, error.message);
  if (!data) throw new PhotoHttpError(404, "Link não encontrado.");
  const share = mapShare(data as unknown as ShareRow);
  revalidatePath(galleryPath(share.token));
  return share;
}

/** Refaz na hora as páginas de convidado de um álbum (fotos escondidas ou mostradas). */
async function revalidateAlbumGalleries(albumId: string): Promise<void> {
  const db = await getServerDb();
  const { data } = await db
    .from("event_photo_album_shares")
    .select("token")
    .eq("album_id", albumId)
    .is("revoked_at", null);
  for (const row of data ?? []) revalidatePath(galleryPath(row.token as string));
}

/** Esconde ou mostra fotos no link de convidado (a equipe continua vendo todas no álbum). */
export async function setPhotosGuestHidden(
  actor: Actor,
  albumId: string,
  input: { photoIds?: unknown; hidden?: unknown }
): Promise<string[]> {
  assertManager(actor);
  if (!Array.isArray(input.photoIds) || input.photoIds.length === 0 || input.photoIds.length > 1000) {
    throw new PhotoHttpError(400, "Selecione entre 1 e 1000 fotos.");
  }
  if (typeof input.hidden !== "boolean") throw new PhotoHttpError(400, "Informe se as fotos ficam escondidas.");
  const ids = [...new Set(input.photoIds.map(String))];
  const db = await getServerDb();
  const { data, error } = await db
    .from("event_photos")
    .update({ guest_hidden: input.hidden })
    .eq("album_id", albumId)
    .in("id", ids)
    .select("id");
  if (error) throw new PhotoHttpError(500, error.message);
  await revalidateAlbumGalleries(albumId);
  return (data ?? []).map((row) => row.id as string);
}

interface GalleryPhotoRow {
  id: string;
  public_url: string;
  preview_url: string | null;
  original_filename: string | null;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  created_at: string;
}

/**
 * Álbum montado para a página pública. null = link inexistente, revogado, vencido ou álbum oculto
 * (a página mostra a mesma mensagem nos quatro casos, sem dizer qual).
 */
export async function loadPublicGallery(token: string): Promise<PublicGallery | null> {
  if (!isShareToken(token)) return null;
  const db = await getServerDb();
  const { data: share, error } = await db
    .from("event_photo_album_shares")
    .select("album_id, token, label, logo_url, allow_download, expires_at, revoked_at")
    .eq("token", token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!share) return null;
  if (shareStatus({ revokedAt: share.revoked_at, expiresAt: share.expires_at }) !== "active") return null;

  const { data: album, error: albumError } = await db
    .from("event_photo_albums")
    .select("id, slug, title, description, event_date, event_id, cover_photo_id, is_published")
    .eq("id", share.album_id)
    .maybeSingle();
  if (albumError) throw new Error(albumError.message);
  if (!album || !album.is_published) return null;

  const rows: GalleryPhotoRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error: photosError } = await db
      .from("event_photos")
      .select("id, public_url, preview_url, original_filename, width, height, size_bytes, created_at")
      .eq("album_id", album.id)
      .eq("guest_hidden", false)
      .order("created_at")
      .range(from, from + 999);
    if (photosError) throw new Error(photosError.message);
    rows.push(...((data ?? []) as GalleryPhotoRow[]));
    if (!data || data.length < 1000) break;
  }
  rows.sort(
    (a, b) => compareEventPhotoNames(a.original_filename, b.original_filename) || a.created_at.localeCompare(b.created_at)
  );

  let location: string | null = null;
  if (album.event_id) {
    const { data: event } = await db.from("events").select("location").eq("id", album.event_id).maybeSingle();
    location = (event?.location as string | null) ?? null;
  }

  const photos: PublicGalleryPhoto[] = rows.map((row, index) => ({
    id: row.id,
    previewUrl: row.preview_url ?? row.public_url,
    originalUrl: row.public_url,
    width: row.width,
    height: row.height,
    sizeBytes: row.size_bytes,
    downloadName: eventPhotoDownloadName(album.slug as string, index, row.original_filename),
  }));
  const coverRow = rows.find((row) => row.id === album.cover_photo_id) ?? rows[0] ?? null;

  return {
    token: share.token as string,
    label: share.label as string,
    logoUrl: (share.logo_url as string | null) ?? null,
    allowDownload: share.allow_download as boolean,
    expiresAt: (share.expires_at as string | null) ?? null,
    album: {
      slug: album.slug as string,
      title: album.title as string,
      description: (album.description as string | null) ?? null,
      eventDate: (album.event_date as string | null) ?? null,
      location,
    },
    cover: coverRow
      ? { url: coverRow.preview_url ?? coverRow.public_url, shareImageUrl: shareImageUrl(coverRow.public_url) }
      : null,
    photos,
  };
}

/** Uma abertura da página (o navegador manda uma vez por sessão). */
export async function recordShareOpen(token: string): Promise<void> {
  if (!isShareToken(token)) return;
  const db = await getServerDb();
  await db.rpc("event_photo_share_opened", { p_token: token });
}
