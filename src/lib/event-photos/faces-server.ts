import { getServerDb } from "@/lib/users-server";
import { PhotoHttpError, isEventPhotosManager, type resolveAppUser } from "@/lib/event-photos/server";
import {
  FACE_CONSENT_VERSION,
  FACE_MATCH_THRESHOLD,
  FACE_MAX_REFERENCES,
  isFaceDescriptor,
  type FaceMatch,
  type FaceReferenceSet,
} from "@/lib/event-photos/faces";
import type { FaceStatus, ScanQueueAlbum } from "@/lib/event-photos/types";

type Actor = Awaited<ReturnType<typeof resolveAppUser>>;

async function loadConsent(userId: string): Promise<{ consented_at: string } | null> {
  const db = await getServerDb();
  const { data, error } = await db
    .from("event_face_consents")
    .select("consented_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new PhotoHttpError(500, error.message);
  return data as { consented_at: string } | null;
}

async function requireConsent(userId: string): Promise<{ consented_at: string }> {
  const consent = await loadConsent(userId);
  if (!consent) throw new PhotoHttpError(403, "Ative o reconhecimento facial antes.");
  return consent;
}

/** Álbuns publicados com fotos anteriores ao consentimento que o usuário ainda não varreu. */
async function pendingScanAlbums(
  userId: string,
  consentedAt: string
): Promise<Array<{ id: string; title: string }>> {
  const db = await getServerDb();
  const [{ data: albums, error: albumsError }, { data: scans, error: scansError }] = await Promise.all([
    db.from("event_photo_albums").select("id, title").eq("is_published", true),
    db.from("event_face_album_scans").select("album_id").eq("user_id", userId),
  ]);
  if (albumsError) throw new PhotoHttpError(500, albumsError.message);
  if (scansError) throw new PhotoHttpError(500, scansError.message);
  const scanned = new Set((scans ?? []).map((s) => s.album_id as string));
  const candidates = (albums ?? []).filter((a) => !scanned.has(a.id as string));

  const withPhotos = await Promise.all(
    candidates.map(async (album) => {
      const { count } = await db
        .from("event_photos")
        .select("id", { count: "exact", head: true })
        .eq("album_id", album.id)
        .lte("created_at", consentedAt);
      return (count ?? 0) > 0 ? { id: album.id as string, title: album.title as string } : null;
    })
  );
  return withPhotos.filter((a): a is { id: string; title: string } => a !== null);
}

export async function getFaceStatus(actor: Actor): Promise<FaceStatus> {
  const consent = await loadConsent(actor.id);
  if (!consent) {
    return {
      consented: false,
      consentedAt: null,
      consentVersion: FACE_CONSENT_VERSION,
      referenceCount: 0,
      matchCount: 0,
      pendingScanAlbums: 0,
    };
  }
  const db = await getServerDb();
  const [refs, matches, pending] = await Promise.all([
    db.from("event_face_references").select("id", { count: "exact", head: true }).eq("user_id", actor.id),
    db
      .from("event_photo_face_matches")
      .select("photo_id", { count: "exact", head: true })
      .eq("user_id", actor.id)
      .is("rejected_at", null),
    pendingScanAlbums(actor.id, consent.consented_at),
  ]);
  return {
    consented: true,
    consentedAt: consent.consented_at,
    consentVersion: FACE_CONSENT_VERSION,
    referenceCount: refs.count ?? 0,
    matchCount: matches.count ?? 0,
    pendingScanAlbums: pending.length,
  };
}

export async function grantFaceConsent(
  actor: Actor,
  input: { consentVersion?: unknown; references?: unknown }
): Promise<FaceStatus> {
  if (input.consentVersion !== FACE_CONSENT_VERSION) {
    throw new PhotoHttpError(400, "Termo de consentimento desatualizado. Recarregue a página.");
  }
  const raw = Array.isArray(input.references) ? input.references : [];
  const references = raw
    .slice(0, FACE_MAX_REFERENCES)
    .map((item) => item as { sourcePhotoId?: unknown; descriptor?: unknown })
    .filter((item) => isFaceDescriptor(item.descriptor));
  if (references.length === 0) {
    throw new PhotoHttpError(400, "Não encontramos um rosto nas suas fotos para usar como referência.");
  }

  const db = await getServerDb();
  const sourceIds = references
    .map((r) => (typeof r.sourcePhotoId === "string" ? r.sourcePhotoId : null))
    .filter((id): id is string => Boolean(id));
  let ownIds = new Set<string>();
  if (sourceIds.length > 0) {
    const { data, error } = await db
      .from("collaborator_photos")
      .select("id")
      .eq("user_id", actor.id)
      .in("id", sourceIds);
    if (error) throw new PhotoHttpError(500, error.message);
    ownIds = new Set((data ?? []).map((r) => r.id as string));
  }

  // Reconsentir recomeça do zero: apaga referências, correspondências e varreduras antigas.
  const { error: resetError } = await db.from("event_face_consents").delete().eq("user_id", actor.id);
  if (resetError) throw new PhotoHttpError(500, resetError.message);
  const { error: consentError } = await db
    .from("event_face_consents")
    .insert({ user_id: actor.id, consent_version: FACE_CONSENT_VERSION });
  if (consentError) throw new PhotoHttpError(500, consentError.message);

  const { error: refsError } = await db.from("event_face_references").insert(
    references.map((r) => ({
      user_id: actor.id,
      source_photo_id:
        typeof r.sourcePhotoId === "string" && ownIds.has(r.sourcePhotoId) ? r.sourcePhotoId : null,
      descriptor: r.descriptor,
    }))
  );
  if (refsError) {
    await db.from("event_face_consents").delete().eq("user_id", actor.id);
    throw new PhotoHttpError(500, refsError.message);
  }

  await db
    .from("event_face_consent_log")
    .insert({ user_id: actor.id, action: "granted", consent_version: FACE_CONSENT_VERSION });
  return getFaceStatus(actor);
}

export async function revokeFaceConsent(actor: Actor): Promise<FaceStatus> {
  const db = await getServerDb();
  const consent = await loadConsent(actor.id);
  const { error } = await db.from("event_face_consents").delete().eq("user_id", actor.id);
  if (error) throw new PhotoHttpError(500, error.message);
  if (consent) {
    await db.from("event_face_consent_log").insert({ user_id: actor.id, action: "revoked" });
  }
  return getFaceStatus(actor);
}

/** Álbuns a varrer + as referências do próprio usuário (a comparação roda no navegador dele). */
export async function getScanQueue(
  actor: Actor
): Promise<{ albums: ScanQueueAlbum[]; descriptors: number[][] }> {
  const consent = await requireConsent(actor.id);
  const albums = await pendingScanAlbums(actor.id, consent.consented_at);
  const db = await getServerDb();
  const { data: refs, error: refsError } = await db
    .from("event_face_references")
    .select("descriptor")
    .eq("user_id", actor.id);
  if (refsError) throw new PhotoHttpError(500, refsError.message);
  const queue = await Promise.all(
    albums.map(async (album) => {
      const { data, error } = await db
        .from("event_photos")
        .select("id, public_url, preview_url")
        .eq("album_id", album.id)
        .lte("created_at", consent.consented_at)
        .order("created_at");
      if (error) throw new PhotoHttpError(500, error.message);
      return {
        albumId: album.id,
        title: album.title,
        photos: (data ?? []).map((p) => ({
          id: p.id as string,
          url: (p.preview_url as string | null) ?? (p.public_url as string),
        })),
      };
    })
  );
  return { albums: queue, descriptors: (refs ?? []).map((r) => r.descriptor as number[]) };
}

function sanitizeDistance(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value < FACE_MATCH_THRESHOLD
    ? value
    : null;
}

export async function saveSelfScan(
  actor: Actor,
  input: { albumId?: unknown; matches?: unknown }
): Promise<{ saved: number }> {
  await requireConsent(actor.id);
  const albumId = typeof input.albumId === "string" ? input.albumId : "";
  if (!albumId) throw new PhotoHttpError(400, "Álbum inválido.");
  const raw = Array.isArray(input.matches) ? input.matches : [];
  const matches = raw
    .map((m) => m as { photoId?: unknown; distance?: unknown })
    .map((m) => ({ photoId: typeof m.photoId === "string" ? m.photoId : "", distance: sanitizeDistance(m.distance) }))
    .filter((m): m is { photoId: string; distance: number } => Boolean(m.photoId) && m.distance !== null);

  const db = await getServerDb();
  let saved = 0;
  if (matches.length > 0) {
    const { data: photos, error } = await db
      .from("event_photos")
      .select("id")
      .eq("album_id", albumId)
      .in("id", matches.map((m) => m.photoId));
    if (error) throw new PhotoHttpError(500, error.message);
    const valid = new Set((photos ?? []).map((p) => p.id as string));
    const rows = matches
      .filter((m) => valid.has(m.photoId))
      .map((m) => ({ photo_id: m.photoId, user_id: actor.id, distance: m.distance, source: "self_scan" }));
    if (rows.length > 0) {
      // ignoreDuplicates preserva um "não sou eu" já marcado.
      const { error: insertError } = await db
        .from("event_photo_face_matches")
        .upsert(rows, { onConflict: "photo_id,user_id", ignoreDuplicates: true });
      if (insertError) throw new PhotoHttpError(500, insertError.message);
      saved = rows.length;
    }
  }

  const { error: scanError } = await db
    .from("event_face_album_scans")
    .upsert({ user_id: actor.id, album_id: albumId, scanned_at: new Date().toISOString() });
  if (scanError) throw new PhotoHttpError(500, scanError.message);
  return { saved };
}

/** Referências de todos que consentiram, para o navegador do marketing comparar no upload. */
export async function listFaceReferencesForUpload(actor: Actor): Promise<FaceReferenceSet[]> {
  if (!isEventPhotosManager(actor)) {
    throw new PhotoHttpError(403, "Só o marketing sobe fotos de eventos.");
  }
  const db = await getServerDb();
  const { data, error } = await db.from("event_face_references").select("user_id, descriptor");
  if (error) throw new PhotoHttpError(500, error.message);
  const byUser = new Map<string, number[][]>();
  for (const row of data ?? []) {
    const list = byUser.get(row.user_id as string) ?? [];
    list.push(row.descriptor as number[]);
    byUser.set(row.user_id as string, list);
  }
  return [...byUser.entries()].map(([userId, descriptors]) => ({ userId, descriptors }));
}

/** Grava as correspondências calculadas no upload (só para quem tem consentimento ativo). */
export async function saveUploadMatches(photoId: string, raw: unknown): Promise<void> {
  if (!Array.isArray(raw) || raw.length === 0) return;
  const matches = raw
    .map((m) => m as Partial<FaceMatch>)
    .map((m) => ({ userId: typeof m.userId === "string" ? m.userId : "", distance: sanitizeDistance(m.distance) }))
    .filter((m): m is FaceMatch => Boolean(m.userId) && m.distance !== null)
    .slice(0, 100);
  if (matches.length === 0) return;

  const db = await getServerDb();
  const { data: consents, error } = await db
    .from("event_face_consents")
    .select("user_id")
    .in("user_id", matches.map((m) => m.userId));
  if (error) throw new PhotoHttpError(500, error.message);
  const allowed = new Set((consents ?? []).map((c) => c.user_id as string));
  const rows = matches
    .filter((m) => allowed.has(m.userId))
    .map((m) => ({ photo_id: photoId, user_id: m.userId, distance: m.distance, source: "upload" }));
  if (rows.length === 0) return;
  const { error: insertError } = await db
    .from("event_photo_face_matches")
    .upsert(rows, { onConflict: "photo_id,user_id", ignoreDuplicates: true });
  if (insertError) throw new PhotoHttpError(500, insertError.message);
}

export async function listMyMatchedPhotoIds(actor: Actor, albumId: string): Promise<string[]> {
  const db = await getServerDb();
  const { data, error } = await db
    .from("event_photo_face_matches")
    .select("photo_id, event_photos!inner(album_id)")
    .eq("user_id", actor.id)
    .eq("event_photos.album_id", albumId)
    .is("rejected_at", null);
  if (error) throw new PhotoHttpError(500, error.message);
  return (data ?? []).map((row) => row.photo_id as string);
}

export async function listMyMatchCountsByAlbum(actor: Actor): Promise<Record<string, number>> {
  const db = await getServerDb();
  const { data, error } = await db
    .from("event_photo_face_matches")
    .select("photo_id, event_photos!inner(album_id)")
    .eq("user_id", actor.id)
    .is("rejected_at", null);
  if (error) throw new PhotoHttpError(500, error.message);
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as unknown as Array<{ event_photos: { album_id: string } | null }>) {
    const albumId = row.event_photos?.album_id;
    if (albumId) counts[albumId] = (counts[albumId] ?? 0) + 1;
  }
  return counts;
}

export async function rejectFaceMatch(actor: Actor, photoId: unknown): Promise<void> {
  if (typeof photoId !== "string" || !photoId) throw new PhotoHttpError(400, "Foto inválida.");
  const db = await getServerDb();
  const { error } = await db
    .from("event_photo_face_matches")
    .update({ rejected_at: new Date().toISOString() })
    .eq("photo_id", photoId)
    .eq("user_id", actor.id);
  if (error) throw new PhotoHttpError(500, error.message);
}
