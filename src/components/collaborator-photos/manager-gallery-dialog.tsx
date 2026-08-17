"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload } from "lucide-react";
import { PhotoConfirmDialog } from "@/components/collaborator-photos/photo-confirm-dialog";
import { PhotoGalleryGrid } from "@/components/collaborator-photos/photo-gallery-grid";
import {
  deleteGalleryPhoto,
  fetchGallery,
  fetchPhotoSessions,
  fetchUsageTypes,
  registerUploadedPhoto,
  setGalleryUsage,
} from "@/lib/collaborator-photos/api";
import {
  validateCollaboratorPhotoFile,
  buildCollaboratorPhotoFileName,
  imageExtensionFromName,
  nextPhotoSequence,
} from "@/lib/collaborator-photos/upload";
import { uploadCollaboratorPhoto } from "@/lib/storage-buckets";
import type {
  CollaboratorPhoto,
  PhotoSession,
  PhotoUsageType,
} from "@/lib/collaborator-photos/types";

export interface GalleryPerson {
  id: string;
  name: string;
  department?: string | null;
  avatar_url?: string | null;
}

interface ManagerGalleryDialogProps {
  open: boolean;
  person: GalleryPerson | null;
  onOpenChange: (open: boolean) => void;
  onChanged?: (userId: string) => void;
}

export function ManagerGalleryDialog({
  open,
  person,
  onOpenChange,
  onChanged,
}: ManagerGalleryDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<CollaboratorPhoto[]>([]);
  const [usageTypes, setUsageTypes] = useState<PhotoUsageType[]>([]);
  const [sessions, setSessions] = useState<PhotoSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [filterSessionId, setFilterSessionId] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyPhotoId, setBusyPhotoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeletePhoto, setPendingDeletePhoto] = useState<CollaboratorPhoto | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open || !person) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [nextPhotos, nextTypes, nextSessions] = await Promise.all([
          fetchGallery(person.id),
          fetchUsageTypes(),
          fetchPhotoSessions(),
        ]);
        if (cancelled) return;
        setPhotos(nextPhotos);
        setUsageTypes(nextTypes);
        setSessions(nextSessions);
        const preferred =
          nextSessions.find((s) => s.slug === "fotos-corporativas-2026") ?? nextSessions[0];
        setSelectedSessionId(preferred?.id ?? "");
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro ao carregar galeria.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, person]);

  const visiblePhotos = useMemo(() => {
    if (filterSessionId === "all") return photos;
    if (filterSessionId === "none") return photos.filter((photo) => !photo.sessionId);
    return photos.filter((photo) => photo.sessionId === filterSessionId);
  }, [photos, filterSessionId]);

  async function handleFiles(fileList: FileList | null) {
    if (!person || !fileList?.length) return;
    if (!selectedSessionId) {
      setError("Selecione a sessão antes de subir (ex.: Fotos Corporativas 2026).");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      let sequence = nextPhotoSequence(
        photos.map((photo) => photo.originalFilename),
        person.name
      );
      for (const file of Array.from(fileList)) {
        const invalid = validateCollaboratorPhotoFile(file);
        if (invalid) throw new Error(`${file.name}: ${invalid}`);
        const fileName = buildCollaboratorPhotoFileName(
          person.name,
          sequence,
          imageExtensionFromName(file.name)
        );
        const uploaded = await uploadCollaboratorPhoto(person.id, file, fileName);
        const photo = await registerUploadedPhoto({
          userId: person.id,
          storagePath: uploaded.path,
          publicUrl: uploaded.publicUrl,
          originalFilename: fileName,
          sessionId: selectedSessionId,
        });
        sequence += 1;
        setPhotos((prev) => [photo, ...prev.filter((item) => item.id !== photo.id)]);
      }
      onChanged?.(person.id);
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
      throw err;
    } finally {
      setBusyPhotoId(null);
    }
  }

  async function handleDelete(photo: CollaboratorPhoto) {
    setPendingDeletePhoto(photo);
    return false;
  }

  async function confirmDeletePhoto() {
    if (!pendingDeletePhoto || deleting) return;
    const photo = pendingDeletePhoto;
    setDeleting(true);
    setBusyPhotoId(photo.id);
    setError(null);
    try {
      await deleteGalleryPhoto(photo.id);
      setPhotos((prev) => prev.filter((item) => item.id !== photo.id));
      onChanged?.(photo.userId);
      setPendingDeletePhoto(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao apagar foto.");
    } finally {
      setDeleting(false);
      setBusyPhotoId(null);
    }
  }

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Galeria de {person?.name ?? "colaborador"}</DialogTitle>
          <DialogDescription>
            Escolha a sessão antes de subir. Assim você sabe depois quais fotos são das Fotos
            Corporativas 2026 (ou de outra campanha).
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Sessão do upload
              </p>
              <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                <SelectTrigger className="h-9 w-[260px] text-sm">
                  <SelectValue placeholder="Selecione a sessão" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((session) => (
                    <SelectItem key={session.id} value={session.id}>
                      {session.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Filtrar galeria
              </p>
              <Select value={filterSessionId} onValueChange={setFilterSessionId}>
                <SelectTrigger className="h-9 w-[220px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as sessões</SelectItem>
                  <SelectItem value="none">Sem sessão</SelectItem>
                  {sessions.map((session) => (
                    <SelectItem key={session.id} value={session.id}>
                      {session.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground">
              {visiblePhotos.length} foto{visiblePhotos.length === 1 ? "" : "s"}
              {selectedSession ? ` · subir em “${selectedSession.label}”` : ""}
            </p>
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
              disabled={uploading || !person || !selectedSessionId}
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
            photos={visiblePhotos}
            usageTypes={usageTypes}
            busyPhotoId={busyPhotoId}
            canDelete
            sessions={sessions}
            emptyTitle="Nenhuma foto nesta galeria"
            emptyDescription="Suba as fotos da pasta desta pessoa no Drive, marcando a sessão correta."
            onToggleUsage={handleToggle}
            onDelete={handleDelete}
            onPhotosRemoved={(photoIds) => {
              const removed = new Set(photoIds);
              setPhotos((prev) => prev.filter((item) => !removed.has(item.id)));
              if (person) onChanged?.(person.id);
            }}
            onGalleryReplaced={(nextPhotos) => {
              setPhotos(nextPhotos);
              if (person) onChanged?.(person.id);
            }}
          />
        )}

        <PhotoConfirmDialog
          open={pendingDeletePhoto !== null}
          title="Excluir foto"
          description={`Apagar “${pendingDeletePhoto?.sessionLabel || pendingDeletePhoto?.originalFilename || "esta foto"}” da galeria? Esta ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          tone="danger"
          busy={deleting}
          onConfirm={() => {
            void confirmDeletePhoto();
          }}
          onOpenChange={(open) => {
            if (!open && !deleting) setPendingDeletePhoto(null);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
