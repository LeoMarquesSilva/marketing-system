"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FolderInput, Images, Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PhotoGalleryCard } from "@/components/collaborator-photos/photo-gallery-card";
import { PhotoLightbox } from "@/components/collaborator-photos/photo-lightbox";
import {
  deleteGalleryPhotosBatch,
  downloadGalleryPhotosZip,
  moveGalleryPhotosSession,
} from "@/lib/collaborator-photos/api";
import { MAX_BATCH_PHOTO_OPS } from "@/lib/collaborator-photos/batch-ops";
import type {
  CollaboratorPhoto,
  PhotoSession,
  PhotoUsageType,
} from "@/lib/collaborator-photos/types";

interface PhotoGalleryGridProps {
  photos: CollaboratorPhoto[];
  usageTypes: PhotoUsageType[];
  busyPhotoId?: string | null;
  canDelete?: boolean;
  /** Sessões ativas — quando informado, permite mudar a sessão das selecionadas (gestor). */
  sessions?: PhotoSession[];
  emptyTitle: string;
  emptyDescription: string;
  onToggleUsage: (photo: CollaboratorPhoto, usage: PhotoUsageType) => void | Promise<void>;
  onDelete?: (photo: CollaboratorPhoto) => boolean | void | Promise<boolean | void>;
  onPhotosRemoved?: (photoIds: string[]) => void;
  onGalleryReplaced?: (photos: CollaboratorPhoto[]) => void;
}

type BatchBusy = "download" | "delete" | "move" | null;

export function PhotoGalleryGrid({
  photos,
  usageTypes,
  busyPhotoId,
  canDelete = false,
  sessions,
  emptyTitle,
  emptyDescription,
  onToggleUsage,
  onDelete,
  onPhotosRemoved,
  onGalleryReplaced,
}: PhotoGalleryGridProps) {
  const [openedPhotoId, setOpenedPhotoId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchBusy, setBatchBusy] = useState<BatchBusy>(null);
  const [moveSessionId, setMoveSessionId] = useState<string>("");
  const [batchMessage, setBatchMessage] = useState<string | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);

  const activeSessions = useMemo(
    () => (sessions ?? []).filter((session) => session.isActive),
    [sessions]
  );
  const canMoveSession = activeSessions.length > 0;
  const photoIdsKey = useMemo(() => photos.map((photo) => photo.id).join("|"), [photos]);

  useEffect(() => {
    setSelectedIds((current) => {
      const available = new Set(photos.map((photo) => photo.id));
      const next = current.filter((id) => available.has(id));
      return next.length === current.length ? current : next;
    });
  }, [photoIdsKey, photos]);

  useEffect(() => {
    if (!canMoveSession) {
      setMoveSessionId("");
      return;
    }
    setMoveSessionId((current) =>
      current && activeSessions.some((session) => session.id === current)
        ? current
        : (activeSessions[0]?.id ?? "")
    );
  }, [activeSessions, canMoveSession]);

  const openedIndex = useMemo(
    () => photos.findIndex((photo) => photo.id === openedPhotoId),
    [openedPhotoId, photos]
  );
  const openedPhoto = openedIndex >= 0 ? photos[openedIndex] : null;
  const selectedCount = selectedIds.length;
  const allSelected = photos.length > 0 && selectedCount === photos.length;
  const selectionHint = canDelete || canMoveSession
    ? "Selecione fotos para baixar, excluir ou mudar de sessão."
    : "Selecione fotos para baixar várias de uma vez.";

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

  const toggleSelect = useCallback((photoId: string) => {
    setBatchError(null);
    setBatchMessage(null);
    setSelectedIds((current) => {
      if (current.includes(photoId)) {
        return current.filter((id) => id !== photoId);
      }
      if (current.length >= MAX_BATCH_PHOTO_OPS) {
        setBatchError(`Selecione no máximo ${MAX_BATCH_PHOTO_OPS} fotos por vez.`);
        return current;
      }
      return [...current, photoId];
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
    setBatchError(null);
    setBatchMessage(null);
  }, []);

  const selectAllVisible = useCallback(() => {
    const ids = photos.map((photo) => photo.id).slice(0, MAX_BATCH_PHOTO_OPS);
    setBatchError(null);
    setBatchMessage(
      photos.length > MAX_BATCH_PHOTO_OPS
        ? `Selecionadas as primeiras ${MAX_BATCH_PHOTO_OPS} fotos.`
        : null
    );
    setSelectedIds(ids);
  }, [photos]);

  const downloadSelected = useCallback(async () => {
    if (selectedIds.length === 0 || batchBusy) return;
    setBatchBusy("download");
    setBatchError(null);
    setBatchMessage(null);
    try {
      await downloadGalleryPhotosZip(selectedIds);
      setBatchMessage(
        selectedIds.length === 1
          ? "Download da foto iniciado."
          : `ZIP com ${selectedIds.length} fotos pronto.`
      );
      setSelectedIds([]);
    } catch (err) {
      setBatchError(err instanceof Error ? err.message : "Erro ao baixar fotos selecionadas.");
    } finally {
      setBatchBusy(null);
    }
  }, [batchBusy, selectedIds]);

  const deleteSelected = useCallback(async () => {
    if (!canDelete || selectedIds.length === 0 || batchBusy) return;
    const label =
      selectedIds.length === 1
        ? "Apagar 1 foto selecionada da galeria?"
        : `Apagar ${selectedIds.length} fotos selecionadas da galeria?`;
    if (!confirm(label)) return;

    setBatchBusy("delete");
    setBatchError(null);
    setBatchMessage(null);
    try {
      const deletedIds = await deleteGalleryPhotosBatch(selectedIds);
      onPhotosRemoved?.(deletedIds);
      setOpenedPhotoId((current) => (current && deletedIds.includes(current) ? null : current));
      setSelectedIds([]);
      setBatchMessage(
        deletedIds.length === 1
          ? "Foto excluída."
          : `${deletedIds.length} fotos excluídas.`
      );
    } catch (err) {
      setBatchError(err instanceof Error ? err.message : "Erro ao excluir fotos selecionadas.");
    } finally {
      setBatchBusy(null);
    }
  }, [batchBusy, canDelete, onPhotosRemoved, selectedIds]);

  const moveSelected = useCallback(async () => {
    if (!canMoveSession || !moveSessionId || selectedIds.length === 0 || batchBusy) return;
    const session = activeSessions.find((item) => item.id === moveSessionId);
    if (!session) {
      setBatchError("Selecione a sessão de destino.");
      return;
    }

    setBatchBusy("move");
    setBatchError(null);
    setBatchMessage(null);
    try {
      const nextPhotos = await moveGalleryPhotosSession(selectedIds, moveSessionId);
      onGalleryReplaced?.(nextPhotos);
      setSelectedIds([]);
      setBatchMessage(
        selectedIds.length === 1
          ? `Foto movida para “${session.label}”.`
          : `${selectedIds.length} fotos movidas para “${session.label}”.`
      );
    } catch (err) {
      setBatchError(err instanceof Error ? err.message : "Erro ao mudar a sessão das fotos.");
    } finally {
      setBatchBusy(null);
    }
  }, [
    activeSessions,
    batchBusy,
    canMoveSession,
    moveSessionId,
    onGalleryReplaced,
    selectedIds,
  ]);

  const deletePhoto = useCallback(
    async (photo: CollaboratorPhoto) => {
      const deleted = await onDelete?.(photo);
      if (deleted) {
        setOpenedPhotoId((current) => (current === photo.id ? null : current));
        setSelectedIds((current) => current.filter((id) => id !== photo.id));
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
      <div className="mb-3 space-y-2">
        <div className="flex flex-col gap-2 rounded-lg border border-[#dce9eb] bg-[#f7fbfb] px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-auto text-xs text-[#5e7a85]">
              {selectedCount === 0
                ? selectionHint
                : `${selectedCount} selecionada${selectedCount === 1 ? "" : "s"}`}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="h-8 text-xs"
              disabled={Boolean(batchBusy)}
              onClick={allSelected ? clearSelection : selectAllVisible}
            >
              {allSelected ? "Limpar seleção" : "Selecionar todas"}
            </Button>
            {selectedCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="h-8 w-8"
                title="Limpar seleção"
                aria-label="Limpar seleção"
                disabled={Boolean(batchBusy)}
                onClick={clearSelection}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              type="button"
              size="xs"
              className="h-8 gap-1.5"
              disabled={selectedCount === 0 || Boolean(batchBusy)}
              onClick={() => {
                void downloadSelected();
              }}
            >
              {batchBusy === "download" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {selectedCount === 0 ? "Baixar" : `Baixar ${selectedCount}`}
            </Button>
            {canDelete && (
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="h-8 gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={selectedCount === 0 || Boolean(batchBusy)}
                onClick={() => {
                  void deleteSelected();
                }}
              >
                {batchBusy === "delete" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                {selectedCount === 0 ? "Excluir" : `Excluir ${selectedCount}`}
              </Button>
            )}
          </div>

          {canMoveSession && (
            <div className="flex flex-wrap items-center gap-2 border-t border-[#e4eef0] pt-2">
              <p className="text-xs font-medium text-[#456370]">Mudar sessão</p>
              <Select
                value={moveSessionId}
                onValueChange={setMoveSessionId}
                disabled={Boolean(batchBusy)}
              >
                <SelectTrigger className="h-8 w-[220px] text-xs">
                  <SelectValue placeholder="Sessão de destino" />
                </SelectTrigger>
                <SelectContent>
                  {activeSessions.map((session) => (
                    <SelectItem key={session.id} value={session.id}>
                      {session.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="h-8 gap-1.5"
                disabled={selectedCount === 0 || !moveSessionId || Boolean(batchBusy)}
                onClick={() => {
                  void moveSelected();
                }}
              >
                {batchBusy === "move" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FolderInput className="h-3.5 w-3.5" />
                )}
                {selectedCount === 0 ? "Mover" : `Mover ${selectedCount}`}
              </Button>
            </div>
          )}
        </div>
        {batchError && (
          <p role="alert" className="text-xs text-destructive">
            {batchError}
          </p>
        )}
        {batchMessage && !batchError && (
          <p className="text-xs text-[#347796]">{batchMessage}</p>
        )}
      </div>

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
            busy={busyPhotoId === photo.id || Boolean(batchBusy)}
            canDelete={canDelete}
            selected={selectedIds.includes(photo.id)}
            onOpen={openPhoto}
            onToggleSelect={toggleSelect}
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
          busy={busyPhotoId === openedPhoto.id || Boolean(batchBusy)}
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
