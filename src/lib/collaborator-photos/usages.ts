import type { PhotoUsageAssignment } from "@/lib/collaborator-photos/types";

export function assignPhotoUsage(
  current: PhotoUsageAssignment[],
  next: PhotoUsageAssignment
): PhotoUsageAssignment[] {
  const withoutSameUsage = current.filter(
    (item) => !(item.userId === next.userId && item.usageTypeSlug === next.usageTypeSlug)
  );
  return [...withoutSameUsage, next];
}

export function clearPhotoUsage(
  current: PhotoUsageAssignment[],
  target: PhotoUsageAssignment
): PhotoUsageAssignment[] {
  return current.filter(
    (item) =>
      !(
        item.userId === target.userId &&
        item.usageTypeSlug === target.usageTypeSlug &&
        item.photoId === target.photoId
      )
  );
}

export function usagesRemainingAfterPhotoDelete(
  current: PhotoUsageAssignment[],
  photoId: string
): PhotoUsageAssignment[] {
  return current.filter((item) => item.photoId !== photoId);
}

export function shouldClearOfficialProjection(input: {
  currentAvatarUrl: string | null | undefined;
  deletedPhotoUrl: string;
  deletedPhotoWasOfficial: boolean;
}): boolean {
  if (!input.deletedPhotoWasOfficial) return false;
  return (input.currentAvatarUrl ?? "") === input.deletedPhotoUrl;
}

export function canDeleteCollaboratorPhoto(input: {
  actorId: string;
  photoUserId: string;
  isManager: boolean;
}): boolean {
  return input.isManager || input.actorId === input.photoUserId;
}
