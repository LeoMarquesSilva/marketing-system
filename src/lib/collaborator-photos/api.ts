import type { CollaboratorPhoto, PhotoUsageType } from "@/lib/collaborator-photos/types";
import type { StorageUsageSummary } from "@/lib/collaborator-photos/storage-usage";

async function parseError(res: Response, fallback: string) {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  throw new Error(data.error || fallback);
}

export async function fetchGallery(userId?: string): Promise<CollaboratorPhoto[]> {
  const qs = userId ? `?userId=${encodeURIComponent(userId)}` : "";
  const res = await fetch(`/api/collaborator-photos${qs}`, { credentials: "include" });
  if (!res.ok) await parseError(res, "Erro ao carregar fotos.");
  const data = (await res.json()) as { photos: CollaboratorPhoto[] };
  return data.photos;
}

export async function fetchUsageTypes(all = false): Promise<PhotoUsageType[]> {
  const res = await fetch(`/api/collaborator-photos/usage-types${all ? "?all=1" : ""}`, {
    credentials: "include",
  });
  if (!res.ok) await parseError(res, "Erro ao carregar usos.");
  const data = (await res.json()) as { usageTypes: PhotoUsageType[] };
  return data.usageTypes;
}

export async function registerUploadedPhoto(input: {
  userId: string;
  storagePath: string;
  publicUrl: string;
  originalFilename?: string | null;
}): Promise<CollaboratorPhoto> {
  const res = await fetch("/api/collaborator-photos", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, "Erro ao registrar foto.");
  const data = (await res.json()) as { photo: CollaboratorPhoto };
  return data.photo;
}

export async function deleteGalleryPhoto(photoId: string): Promise<void> {
  const res = await fetch(`/api/collaborator-photos/${photoId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) await parseError(res, "Erro ao apagar foto.");
}

export async function setGalleryUsage(input: {
  photoId: string;
  usageTypeId: string;
  assigned: boolean;
}): Promise<CollaboratorPhoto[]> {
  const res = await fetch("/api/collaborator-photos/usages", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, "Erro ao salvar uso.");
  const data = (await res.json()) as { photos: CollaboratorPhoto[] };
  return data.photos;
}

export async function fetchGallerySummary(userIds?: string[]): Promise<{
  officialByUserId: Record<string, boolean>;
  photoCountByUserId: Record<string, number>;
}> {
  const qs = new URLSearchParams({ summary: "1" });
  if (userIds?.length) qs.set("userIds", userIds.join(","));
  const res = await fetch(`/api/collaborator-photos?${qs.toString()}`, { credentials: "include" });
  if (!res.ok) await parseError(res, "Erro ao carregar resumo das galerias.");
  return (await res.json()) as {
    officialByUserId: Record<string, boolean>;
    photoCountByUserId: Record<string, number>;
  };
}

export async function createGalleryUsageType(label: string): Promise<PhotoUsageType> {
  const res = await fetch("/api/collaborator-photos/usage-types", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label }),
  });
  if (!res.ok) await parseError(res, "Erro ao criar uso.");
  const data = (await res.json()) as { usageType: PhotoUsageType };
  return data.usageType;
}

export async function patchGalleryUsageType(
  id: string,
  patch: { label?: string; isActive?: boolean }
): Promise<PhotoUsageType> {
  const res = await fetch(`/api/collaborator-photos/usage-types/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) await parseError(res, "Erro ao atualizar uso.");
  const data = (await res.json()) as { usageType: PhotoUsageType };
  return data.usageType;
}

export async function deleteGalleryUsageType(id: string): Promise<void> {
  const res = await fetch(`/api/collaborator-photos/usage-types/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) await parseError(res, "Erro ao apagar uso.");
}

export async function fetchStorageUsage(): Promise<StorageUsageSummary> {
  const res = await fetch("/api/collaborator-photos/storage-usage", { credentials: "include" });
  if (!res.ok) await parseError(res, "Erro ao medir o storage.");
  return (await res.json()) as StorageUsageSummary;
}
