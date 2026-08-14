"use client";

import { useCallback, useMemo, useState } from "react";
import { Images } from "lucide-react";
import { PhotoGalleryCard } from "@/components/collaborator-photos/photo-gallery-card";
import { PhotoLightbox } from "@/components/collaborator-photos/photo-lightbox";
import type { CollaboratorPhoto, PhotoUsageType } from "@/lib/collaborator-photos/types";

interface PhotoGalleryGridProps {
  photos: CollaboratorPhoto[];
  usageTypes: PhotoUsageType[];
  busyPhotoId?: string | null;
  canDelete?: boolean;
  emptyTitle: string;
  emptyDescription: string;
  onToggleUsage: (photo: CollaboratorPhoto, usage: PhotoUsageType) => void | Promise<void>;
  onDelete?: (photo: CollaboratorPhoto) => boolean | void | Promise<boolean | void>;
}

export function PhotoGalleryGrid({
  photos,
  usageTypes,
  busyPhotoId,
  canDelete = false,
  emptyTitle,
  emptyDescription,
  onToggleUsage,
  onDelete,
}: PhotoGalleryGridProps) {
  const [openedPhotoId, setOpenedPhotoId] = useState<string | null>(null);
  const openedIndex = useMemo(
    () => photos.findIndex((photo) => photo.id === openedPhotoId),
    [openedPhotoId, photos]
  );
  const openedPhoto = openedIndex >= 0 ? photos[openedIndex] : null;

  const openPhoto = useCallback((photoId: string) => setOpenedPhotoId(photoId), []);
  const closePhoto = useCallback(() => setOpenedPhotoId(null), []);
  const previousPhoto = useCallback(() => {
    if (openedIndex > 0) setOpenedPhotoId(photos[openedIndex - 1]?.id ?? null);
  }, [openedIndex, photos]);
  const nextPhoto = useCallback(() => {
    if (openedIndex >= 0 && openedIndex < photos.length - 1) {
      setOpenedPhotoId(photos[openedIndex + 1]?.id ?? null);
    }
  }, [openedIndex, photos]);
  const deletePhoto = useCallback(
    async (photo: CollaboratorPhoto) => {
      const deleted = await onDelete?.(photo);
      if (deleted) {
        setOpenedPhotoId((current) => (current === photo.id ? null : current));
      }
      return deleted;
    },
    [onDelete]
  );

  if (photos.length === 0) {
    return (
      <div
        className="rounded-lg border border-dashed border-[#9ec5c8] bg-[#f4fbfb] px-6 py-16 text-center"
        data-tour="mf-gallery"
      >
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-lg border border-[#cce3e5] bg-white text-[#347796] shadow-sm">
          <Images className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="mt-4 text-sm font-semibold text-[#153f51]">{emptyTitle}</p>
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-[#5e7a85]">
          {emptyDescription}
        </p>
      </div>
    );
  }

  return (
    <>
      <div
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
        data-tour="mf-gallery"
      >
        {photos.map((photo, photoIndex) => (
          <PhotoGalleryCard
            key={photo.id}
            photo={photo}
            photoIndex={photoIndex}
            usageTypes={usageTypes}
            busy={busyPhotoId === photo.id}
            canDelete={canDelete}
            onOpen={openPhoto}
            onToggleUsage={onToggleUsage}
            onDelete={onDelete ? deletePhoto : undefined}
          />
        ))}
      </div>

      {openedPhoto && (
        <PhotoLightbox
          key={openedPhoto.id}
          open
          photo={openedPhoto}
          photoIndex={openedIndex}
          photoCount={photos.length}
          usageTypes={usageTypes}
          busy={busyPhotoId === openedPhoto.id}
          canDelete={canDelete}
          onOpenChange={(open) => {
            if (!open) closePhoto();
          }}
          onPrevious={previousPhoto}
          onNext={nextPhoto}
          onToggleUsage={onToggleUsage}
          onDelete={onDelete ? deletePhoto : undefined}
        />
      )}
    </>
  );
}
