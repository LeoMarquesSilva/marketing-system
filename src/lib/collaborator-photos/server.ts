import { getServerDb } from "@/lib/users-server";
import {
  isCollaboratorPhotosManager,
  type AccessProfile,
} from "@/lib/access-control";
import { shouldClearOfficialProjection, canDeleteCollaboratorPhoto } from "@/lib/collaborator-photos/usages";
import {
  assertUsageTypeCanDeactivate,
  assertUsageTypeCanDelete,
  slugifyUsageLabel,
} from "@/lib/collaborator-photos/usage-types";
import {
  buildCollaboratorPhotoFileName,
  downloadFileNameForPhoto,
  imageExtensionFromName,
  nextPhotoSequence,
} from "@/lib/collaborator-photos/upload";
import type { CollaboratorPhoto, PhotoUsageType } from "@/lib/collaborator-photos/types";
import {
  aggregateStorageUsage,
  SUPABASE_PRO_STORAGE_QUOTA_BYTES,
  type StorageUsageSummary,
} from "@/lib/collaborator-photos/storage-usage";

const COLLABORATOR_PHOTOS_BUCKET = "MARKETING-SYSTEM-FOTOS";

export class PhotoHttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "PhotoHttpError";
  }
}

interface AppUserRow {
  id: string;
  name: string;
  role: string | null;
  permissions: string[] | null;
}

interface PhotoRow {
  id: string;
  user_id: string;
  storage_path: string;
  public_url: string;
  original_filename: string | null;
  uploaded_by: string | null;
  created_at: string;
}

interface UsageTypeRow {
  id: string;
  slug: string;
  label: string;
  is_official: boolean;
  is_system: boolean;
  sort_order: number;
  is_active: boolean;
}

interface UsageRow {
  user_id: string;
  usage_type_id: string;
  photo_id: string;
}

export async function resolveAppUser(authUserId: string): Promise<AppUserRow> {
  const db = await getServerDb();
  const { data, error } = await db
    .from("users")
    .select("id, name, role, permissions")
    .eq("auth_id", authUserId)
    .maybeSingle();
  if (error) throw new PhotoHttpError(500, error.message);
  if (!data) throw new PhotoHttpError(401, "Usuário não encontrado.");
  return data as AppUserRow;
}

function asProfile(user: AppUserRow): AccessProfile {
  return { id: user.id, role: user.role, permissions: user.permissions };
}

function assertManager(user: AppUserRow): void {
  if (!isCollaboratorPhotosManager(asProfile(user))) {
    throw new PhotoHttpError(403, "Sem permissão para gerenciar fotos de colaboradores.");
  }
}

function mapUsageType(row: UsageTypeRow): PhotoUsageType {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    isOfficial: row.is_official,
    isSystem: row.is_system,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

export async function listUsageTypes(includeInactive = false): Promise<PhotoUsageType[]> {
  const db = await getServerDb();
  let query = db
    .from("photo_usage_types")
    .select("id, slug, label, is_official, is_system, sort_order, is_active")
    .order("sort_order");
  if (!includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw new PhotoHttpError(500, error.message);
  return ((data ?? []) as UsageTypeRow[]).map(mapUsageType);
}

export async function listGalleryForUser(userId: string): Promise<CollaboratorPhoto[]> {
  const db = await getServerDb();
  const [{ data: photos, error: photosError }, { data: usages, error: usagesError }, types] =
    await Promise.all([
      db
        .from("collaborator_photos")
        .select("id, user_id, storage_path, public_url, original_filename, uploaded_by, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      db
        .from("collaborator_photo_usages")
        .select("user_id, usage_type_id, photo_id")
        .eq("user_id", userId),
      listUsageTypes(true),
    ]);
  if (photosError) throw new PhotoHttpError(500, photosError.message);
  if (usagesError) throw new PhotoHttpError(500, usagesError.message);

  const typeById = new Map(types.map((t) => [t.id, t]));
  const slugsByPhoto = new Map<string, string[]>();
  for (const usage of (usages ?? []) as UsageRow[]) {
    const slug = typeById.get(usage.usage_type_id)?.slug;
    if (!slug) continue;
    const list = slugsByPhoto.get(usage.photo_id) ?? [];
    list.push(slug);
    slugsByPhoto.set(usage.photo_id, list);
  }

  return ((photos ?? []) as PhotoRow[]).map((row) => ({
    id: row.id,
    userId: row.user_id,
    storagePath: row.storage_path,
    publicUrl: row.public_url,
    originalFilename: row.original_filename,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
    usageSlugs: slugsByPhoto.get(row.id) ?? [],
  }));
}

export function assertCanViewGallery(actor: AppUserRow, targetUserId: string): void {
  if (actor.id === targetUserId) return;
  assertManager(actor);
}

export async function createPhotoRecord(
  actor: AppUserRow,
  input: { userId: string; storagePath: string; publicUrl: string; originalFilename?: string | null }
): Promise<CollaboratorPhoto> {
  assertManager(actor);
  const db = await getServerDb();
  const { data: owner, error: ownerError } = await db
    .from("users")
    .select("name")
    .eq("id", input.userId)
    .maybeSingle();
  if (ownerError) throw new PhotoHttpError(500, ownerError.message);
  if (!owner?.name) throw new PhotoHttpError(404, "Colaborador não encontrado.");

  const { data: existing, error: existingError } = await db
    .from("collaborator_photos")
    .select("original_filename")
    .eq("user_id", input.userId);
  if (existingError) throw new PhotoHttpError(500, existingError.message);

  const sequence = nextPhotoSequence(
    (existing ?? []).map((row) => row.original_filename as string | null),
    owner.name
  );
  const originalFilename = buildCollaboratorPhotoFileName(
    owner.name,
    sequence,
    imageExtensionFromName(input.originalFilename || input.storagePath)
  );

  const { data, error } = await db
    .from("collaborator_photos")
    .insert({
      user_id: input.userId,
      storage_path: input.storagePath,
      public_url: input.publicUrl,
      original_filename: originalFilename,
      uploaded_by: actor.id,
    })
    .select("id, user_id, storage_path, public_url, original_filename, uploaded_by, created_at")
    .single();
  if (error || !data) throw new PhotoHttpError(500, error?.message ?? "Erro ao registrar foto.");
  const row = data as PhotoRow;
  return {
    id: row.id,
    userId: row.user_id,
    storagePath: row.storage_path,
    publicUrl: row.public_url,
    originalFilename: row.original_filename,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
    usageSlugs: [],
  };
}

export async function deletePhoto(actor: AppUserRow, photoId: string): Promise<void> {
  const db = await getServerDb();
  const { data: photo, error: photoError } = await db
    .from("collaborator_photos")
    .select("id, user_id, storage_path, public_url")
    .eq("id", photoId)
    .maybeSingle();
  if (photoError) throw new PhotoHttpError(500, photoError.message);
  if (!photo) throw new PhotoHttpError(404, "Foto não encontrada.");

  if (
    !canDeleteCollaboratorPhoto({
      actorId: actor.id,
      photoUserId: photo.user_id,
      isManager: isCollaboratorPhotosManager(asProfile(actor)),
    })
  ) {
    throw new PhotoHttpError(403, "Sem permissão para apagar esta foto.");
  }

  const types = await listUsageTypes(true);
  const official = types.find((t) => t.isOfficial);
  const { data: officialUsage } = official
    ? await db
        .from("collaborator_photo_usages")
        .select("photo_id")
        .eq("user_id", photo.user_id)
        .eq("usage_type_id", official.id)
        .maybeSingle()
    : { data: null };

  const wasOfficial = officialUsage?.photo_id === photoId;

  const { data: userRow } = await db
    .from("users")
    .select("avatar_url")
    .eq("id", photo.user_id)
    .maybeSingle();

  const { error: deleteError } = await db.from("collaborator_photos").delete().eq("id", photoId);
  if (deleteError) throw new PhotoHttpError(500, deleteError.message);

  await db.storage.from(COLLABORATOR_PHOTOS_BUCKET).remove([photo.storage_path]);

  if (
    shouldClearOfficialProjection({
      currentAvatarUrl: userRow?.avatar_url,
      deletedPhotoUrl: photo.public_url,
      deletedPhotoWasOfficial: wasOfficial,
    })
  ) {
    await applyOfficialProjection(photo.user_id, null);
  }
}

export async function getPhotoDownload(
  actor: AppUserRow,
  photoId: string
): Promise<{ filename: string; blob: Blob }> {
  const db = await getServerDb();
  const { data: photo, error: photoError } = await db
    .from("collaborator_photos")
    .select("id, user_id, storage_path, original_filename, created_at")
    .eq("id", photoId)
    .maybeSingle();
  if (photoError) throw new PhotoHttpError(500, photoError.message);
  if (!photo) throw new PhotoHttpError(404, "Foto não encontrada.");
  await assertCanViewGallery(actor, photo.user_id);

  const { data: owner, error: ownerError } = await db
    .from("users")
    .select("name")
    .eq("id", photo.user_id)
    .maybeSingle();
  if (ownerError) throw new PhotoHttpError(500, ownerError.message);

  const { data: siblings, error: siblingsError } = await db
    .from("collaborator_photos")
    .select("id")
    .eq("user_id", photo.user_id)
    .order("created_at", { ascending: true });
  if (siblingsError) throw new PhotoHttpError(500, siblingsError.message);
  const chronologicalIndex =
    (siblings ?? []).findIndex((row) => row.id === photoId) + 1 || 1;

  const filename = downloadFileNameForPhoto(
    owner?.name ?? "colaborador",
    { originalFilename: photo.original_filename },
    chronologicalIndex
  );

  const { data: file, error: fileError } = await db.storage
    .from(COLLABORATOR_PHOTOS_BUCKET)
    .download(photo.storage_path);
  if (fileError || !file) {
    throw new PhotoHttpError(404, fileError?.message ?? "Arquivo não encontrado no storage.");
  }
  return { filename, blob: file };
}

export async function setPhotoUsage(
  actor: AppUserRow,
  input: { photoId: string; usageTypeId: string; assigned: boolean }
): Promise<CollaboratorPhoto[]> {
  const db = await getServerDb();
  const { data: photo, error: photoError } = await db
    .from("collaborator_photos")
    .select("id, user_id, public_url")
    .eq("id", input.photoId)
    .maybeSingle();
  if (photoError) throw new PhotoHttpError(500, photoError.message);
  if (!photo) throw new PhotoHttpError(404, "Foto não encontrada.");

  if (actor.id !== photo.user_id) assertManager(actor);

  const { data: usageType, error: typeError } = await db
    .from("photo_usage_types")
    .select("id, slug, label, is_official, is_system, sort_order, is_active")
    .eq("id", input.usageTypeId)
    .maybeSingle();
  if (typeError) throw new PhotoHttpError(500, typeError.message);
  if (!usageType || usageType.is_active === false) {
    throw new PhotoHttpError(400, "Uso inválido.");
  }

  if (input.assigned) {
    const { error } = await db.from("collaborator_photo_usages").upsert(
      {
        user_id: photo.user_id,
        usage_type_id: input.usageTypeId,
        photo_id: input.photoId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,usage_type_id" }
    );
    if (error) throw new PhotoHttpError(500, error.message);
    if (usageType.is_official) {
      await applyOfficialProjection(photo.user_id, photo.public_url);
    }
  } else {
    const { error } = await db
      .from("collaborator_photo_usages")
      .delete()
      .eq("user_id", photo.user_id)
      .eq("usage_type_id", input.usageTypeId)
      .eq("photo_id", input.photoId);
    if (error) throw new PhotoHttpError(500, error.message);
  }

  return listGalleryForUser(photo.user_id);
}

async function applyOfficialProjection(userId: string, photoUrl: string | null): Promise<void> {
  const db = await getServerDb();
  const { error: userError } = await db.from("users").update({ avatar_url: photoUrl }).eq("id", userId);
  if (userError) throw new PhotoHttpError(500, userError.message);

  const { error: profileError } = await db
    .from("professional_profiles")
    .update({ photo_url: photoUrl })
    .eq("user_id", userId);
  if (profileError) throw new PhotoHttpError(500, profileError.message);
}

export async function createUsageType(
  actor: AppUserRow,
  label: string
): Promise<PhotoUsageType> {
  assertManager(actor);
  const trimmed = label.trim();
  if (!trimmed) throw new PhotoHttpError(400, "Informe o nome do uso.");
  const slug = slugifyUsageLabel(trimmed);
  if (!slug) throw new PhotoHttpError(400, "Nome inválido.");

  const current = await listUsageTypes(true);
  const maxOrder = current.reduce((max, item) => Math.max(max, item.sortOrder), -1);
  const db = await getServerDb();
  const { data, error } = await db
    .from("photo_usage_types")
    .insert({
      slug,
      label: trimmed,
      is_official: false,
      is_system: false,
      is_active: true,
      sort_order: maxOrder + 1,
    })
    .select("id, slug, label, is_official, is_system, sort_order, is_active")
    .single();
  if (error || !data) {
    if (error?.code === "23505") throw new PhotoHttpError(409, "Já existe um uso com esse nome.");
    throw new PhotoHttpError(500, error?.message ?? "Erro ao criar uso.");
  }
  return mapUsageType(data as UsageTypeRow);
}

export async function updateUsageType(
  actor: AppUserRow,
  id: string,
  patch: { label?: string; isActive?: boolean; sortOrder?: number }
): Promise<PhotoUsageType> {
  assertManager(actor);
  const db = await getServerDb();
  const { data: current, error: loadError } = await db
    .from("photo_usage_types")
    .select("id, slug, label, is_official, is_system, sort_order, is_active")
    .eq("id", id)
    .maybeSingle();
  if (loadError) throw new PhotoHttpError(500, loadError.message);
  if (!current) throw new PhotoHttpError(404, "Uso não encontrado.");

  const mapped = mapUsageType(current as UsageTypeRow);
  if (patch.isActive === false) assertUsageTypeCanDeactivate(mapped);

  const updates: Record<string, unknown> = {};
  if (patch.label !== undefined) {
    const trimmed = patch.label.trim();
    if (!trimmed) throw new PhotoHttpError(400, "Informe o nome do uso.");
    updates.label = trimmed;
    if (!mapped.isSystem) updates.slug = slugifyUsageLabel(trimmed);
  }
  if (patch.isActive !== undefined) updates.is_active = patch.isActive;
  if (patch.sortOrder !== undefined) updates.sort_order = patch.sortOrder;

  const { data, error } = await db
    .from("photo_usage_types")
    .update(updates)
    .eq("id", id)
    .select("id, slug, label, is_official, is_system, sort_order, is_active")
    .single();
  if (error || !data) throw new PhotoHttpError(500, error?.message ?? "Erro ao atualizar uso.");
  return mapUsageType(data as UsageTypeRow);
}

export async function deleteUsageType(actor: AppUserRow, id: string): Promise<void> {
  assertManager(actor);
  const db = await getServerDb();
  const { data: current, error: loadError } = await db
    .from("photo_usage_types")
    .select("id, slug, label, is_official, is_system, sort_order, is_active")
    .eq("id", id)
    .maybeSingle();
  if (loadError) throw new PhotoHttpError(500, loadError.message);
  if (!current) throw new PhotoHttpError(404, "Uso não encontrado.");
  assertUsageTypeCanDelete(mapUsageType(current as UsageTypeRow));

  const { error } = await db.from("photo_usage_types").delete().eq("id", id);
  if (error) throw new PhotoHttpError(500, error.message);
}

export async function listOfficialStatusByUserIds(
  userIds?: string[]
): Promise<Record<string, boolean>> {
  const types = await listUsageTypes(true);
  const official = types.find((t) => t.isOfficial);
  if (!official) return {};
  const db = await getServerDb();
  let query = db
    .from("collaborator_photo_usages")
    .select("user_id")
    .eq("usage_type_id", official.id);
  if (userIds && userIds.length > 0) query = query.in("user_id", userIds);
  const { data, error } = await query;
  if (error) throw new PhotoHttpError(500, error.message);
  const chosen = new Set((data ?? []).map((row) => row.user_id as string));
  if (userIds && userIds.length > 0) {
    return Object.fromEntries(userIds.map((id) => [id, chosen.has(id)]));
  }
  return Object.fromEntries([...chosen].map((id) => [id, true]));
}

export async function listPhotoCountsByUserIds(
  userIds?: string[]
): Promise<Record<string, number>> {
  const db = await getServerDb();
  let query = db.from("collaborator_photos").select("user_id");
  if (userIds && userIds.length > 0) query = query.in("user_id", userIds);
  const { data, error } = await query;
  if (error) throw new PhotoHttpError(500, error.message);
  const counts: Record<string, number> = {};
  if (userIds) {
    for (const id of userIds) counts[id] = 0;
  }
  for (const row of data ?? []) {
    const id = row.user_id as string;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

export async function getStorageUsage(actor: AppUserRow): Promise<StorageUsageSummary> {
  assertManager(actor);
  const db = await getServerDb();
  const { data, error } = await db.rpc("storage_usage_by_bucket");
  if (error) throw new PhotoHttpError(500, error.message);
  const buckets = ((data ?? []) as { bucket_id: string; files: number | string; bytes: number | string }[]).map(
    (row) => ({
      bucketId: row.bucket_id,
      files: Number(row.files) || 0,
      bytes: Number(row.bytes) || 0,
    })
  );
  return aggregateStorageUsage(buckets, SUPABASE_PRO_STORAGE_QUOTA_BYTES);
}
