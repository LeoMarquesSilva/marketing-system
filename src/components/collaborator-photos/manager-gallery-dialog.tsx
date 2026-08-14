"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Upload } from "lucide-react";
import { PhotoGalleryGrid } from "@/components/collaborator-photos/photo-gallery-grid";
import {
  deleteGalleryPhoto,
  fetchGallery,
  fetchUsageTypes,
  registerUploadedPhoto,
  setGalleryUsage,
} from "@/lib/collaborator-photos/api";
import { validateCollaboratorPhotoFile, buildCollaboratorPhotoFileName, imageExtensionFromName, nextPhotoSequence } from "@/lib/collaborator-photos/upload";
import { uploadCollaboratorPhoto } from "@/lib/storage-buckets";
import type { CollaboratorPhoto, PhotoUsageType } from "@/lib/collaborator-photos/types";
import type { User } from "@/lib/users";

interface ManagerGalleryDialogProps {
  open: boolean;
  user: User | null;
  onOpenChange: (open: boolean) => void;
  onChanged?: (userId: string) => void;
}

export function ManagerGalleryDialog({
  open,
  user,
  onOpenChange,
  onChanged,
}: ManagerGalleryDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<CollaboratorPhoto[]>([]);
  const [usageTypes, setUsageTypes] = useState<PhotoUsageType[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyPhotoId, setBusyPhotoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [nextPhotos, nextTypes] = await Promise.all([
          fetchGallery(user.id),
          fetchUsageTypes(),
        ]);
        if (cancelled) return;
        setPhotos(nextPhotos);
        setUsageTypes(nextTypes);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro ao carregar galeria.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user]);

  async function handleFiles(fileList: FileList | null) {
    if (!user || !fileList?.length) return;
    setUploading(true);
    setError(null);
    try {
      let sequence = nextPhotoSequence(
        photos.map((photo) => photo.originalFilename),
        user.name
      );
      for (const file of Array.from(fileList)) {
        const invalid = validateCollaboratorPhotoFile(file);
        if (invalid) throw new Error(`${file.name}: ${invalid}`);
        const fileName = buildCollaboratorPhotoFileName(
          user.name,
          sequence,
          imageExtensionFromName(file.name)
        );
        const uploaded = await uploadCollaboratorPhoto(user.id, file, fileName);
        const photo = await registerUploadedPhoto({
          userId: user.id,
          storagePath: uploaded.path,
          publicUrl: uploaded.publicUrl,
          originalFilename: fileName,
        });
        sequence += 1;
        setPhotos((prev) => [photo, ...prev.filter((item) => item.id !== photo.id)]);
      }
      onChanged?.(user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar fotos.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleToggle(photo: CollaboratorPhoto, usage: PhotoUsageType) {
    setBusyPhotoId(photo.id);
    setError(null);
    try {
      const next = await setGalleryUsage({
        photoId: photo.id,
        usageTypeId: usage.id,
        assigned: !photo.usageSlugs.includes(usage.slug),
      });
      setPhotos(next);
      onChanged?.(photo.userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar uso.");
    } finally {
      setBusyPhotoId(null);
    }
  }

  async function handleDelete(photo: CollaboratorPhoto) {
    if (!confirm("Apagar esta foto da galeria?")) return;
    setBusyPhotoId(photo.id);
    setError(null);
    try {
      await deleteGalleryPhoto(photo.id);
      setPhotos((prev) => prev.filter((item) => item.id !== photo.id));
      onChanged?.(photo.userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao apagar foto.");
    } finally {
      setBusyPhotoId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Galeria de {user?.name ?? "colaborador"}</DialogTitle>
          <DialogDescription>
            Suba as fotos da sessão desta pessoa. O colaborador escolhe os usos em Minhas fotos; você
            também pode marcar daqui.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {photos.length} foto{photos.length === 1 ? "" : "s"} na galeria
          </p>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={(e) => void handleFiles(e.target.files)}
            />
            <Button
              type="button"
              className="gap-1.5 bg-[#04202f] text-white hover:bg-[#04202f]/90"
              disabled={uploading || !user}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Enviando…" : "Subir fotos"}
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Carregando galeria…</p>
        ) : (
          <PhotoGalleryGrid
            photos={photos}
            usageTypes={usageTypes}
            busyPhotoId={busyPhotoId}
            canDelete
            emptyTitle="Nenhuma foto nesta galeria"
            emptyDescription="Suba as fotos da pasta desta pessoa no Drive. Elas aparecem para o colaborador em Minhas fotos."
            onToggleUsage={handleToggle}
            onDelete={handleDelete}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
