"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ImageOff,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhotoUsageSelector } from "@/components/collaborator-photos/photo-usage-selector";
import type { CollaboratorPhoto, PhotoUsageType } from "@/lib/collaborator-photos/types";

interface PhotoLightboxProps {
  open: boolean;
  photo: CollaboratorPhoto;
  photoIndex: number;
  photoCount: number;
  usageTypes: PhotoUsageType[];
  busy: boolean;
  canDelete: boolean;
  onOpenChange: (open: boolean) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToggleUsage: (photo: CollaboratorPhoto, usage: PhotoUsageType) => void | Promise<void>;
  onDelete?: (photo: CollaboratorPhoto) => boolean | void | Promise<boolean | void>;
}

function downloadHref(photoId: string) {
  return `/api/collaborator-photos/${photoId}/download`;
}

export function PhotoLightbox({
  open,
  photo,
  photoIndex,
  photoCount,
  usageTypes,
  busy,
  canDelete,
  onOpenChange,
  onPrevious,
  onNext,
  onToggleUsage,
  onDelete,
}: PhotoLightboxProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [imageStatus, setImageStatus] = useState<"loading" | "ready" | "error">("loading");
  const [actionError, setActionError] = useState<string | null>(null);
  const canGoPrevious = photoIndex > 0;
  const canGoNext = photoIndex < photoCount - 1;

  const previous = useCallback(() => {
    if (canGoPrevious) onPrevious();
  }, [canGoPrevious, onPrevious]);

  const next = useCallback(() => {
    if (canGoNext) onNext();
  }, [canGoNext, onNext]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        previous();
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [next, open, previous]);

  async function handleToggle(usage: PhotoUsageType) {
    setActionError(null);
    try {
      await onToggleUsage(photo, usage);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Não foi possível salvar o uso.");
    }
  }

  async function handleDeleteCurrent() {
    if (!onDelete) return;
    setActionError(null);
    try {
      await onDelete(photo);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Não foi possível excluir a foto.");
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-[#02070a]/82 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed inset-2 z-[71] grid min-h-0 grid-rows-[minmax(8rem,1fr)_minmax(14rem,48dvh)] overflow-hidden rounded-lg border border-white/10 bg-[#071924] shadow-[0_32px_100px_-24px_rgba(0,0,0,0.85)] outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:inset-4 md:grid-cols-[minmax(0,1fr)_22rem] md:grid-rows-1"
          aria-describedby="photo-lightbox-description"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            closeRef.current?.focus();
          }}
        >
          <DialogPrimitive.Title className="sr-only">
            {photo.originalFilename || "Foto da sessão"}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description id="photo-lightbox-description" className="sr-only">
            Visualização ampliada da foto, com navegação e seleção de usos.
          </DialogPrimitive.Description>

          <section className="relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_35%,#153747_0%,#0a202c_38%,#05131c_100%)]">
            <div className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:24px_24px]" aria-hidden="true" />

            {imageStatus === "loading" && (
              <div className="absolute inset-0 grid place-items-center text-white/70">
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando foto
                </div>
              </div>
            )}

            {imageStatus === "error" ? (
              <div className="relative flex max-w-sm flex-col items-center px-6 text-center text-white/75">
                <ImageOff className="h-9 w-9 text-[#78cdd0]" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-white">A imagem não pôde ser exibida</p>
                <p className="mt-1 text-xs leading-relaxed text-white/55">
                  Você ainda pode baixar o arquivo original pelo painel.
                </p>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={photo.id}
                src={photo.publicUrl}
                alt={photo.originalFilename || "Foto da sessão"}
                className="relative h-full max-h-full w-full object-contain p-3 transition-opacity duration-200 md:p-8 lg:p-10"
                decoding="async"
                onLoad={() => setImageStatus("ready")}
                onError={() => setImageStatus("error")}
                style={{ opacity: imageStatus === "ready" ? 1 : 0 }}
              />
            )}

            {photoCount > 1 && (
              <>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="absolute left-2 top-1/2 h-11 w-11 -translate-y-1/2 border border-white/12 bg-[#03111a]/72 text-white shadow-lg backdrop-blur-md hover:bg-[#163643] hover:text-white disabled:opacity-20 sm:left-4"
                  disabled={!canGoPrevious}
                  onClick={previous}
                  aria-label="Foto anterior"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="absolute right-2 top-1/2 h-11 w-11 -translate-y-1/2 border border-white/12 bg-[#03111a]/72 text-white shadow-lg backdrop-blur-md hover:bg-[#163643] hover:text-white disabled:opacity-20 sm:right-4"
                  disabled={!canGoNext}
                  onClick={next}
                  aria-label="Próxima foto"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </>
            )}

            <span className="absolute bottom-3 left-3 rounded-md border border-white/10 bg-[#03111a]/70 px-2 py-1 font-mono text-xs tabular-nums text-white/75 backdrop-blur-md sm:bottom-4 sm:left-4">
              {photoIndex + 1} / {photoCount}
            </span>
          </section>

          <aside className="flex min-h-0 flex-col bg-[#f8fbfb] text-[#102f3d]">
            <header className="flex items-start gap-3 border-b border-[#dce9eb] px-4 py-4">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs tabular-nums text-[#5e7a85]">
                  Foto {photoIndex + 1} de {photoCount}
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-[#102f3d]" title={photo.originalFilename || undefined}>
                  {photo.originalFilename || "Foto da sessão"}
                </p>
                {photo.sessionLabel && (
                  <p className="mt-0.5 truncate text-xs text-[#347796]">{photo.sessionLabel}</p>
                )}
              </div>
              <DialogPrimitive.Close asChild>
                <Button
                  ref={closeRef}
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="-mr-1 -mt-1 text-[#456370]"
                  aria-label="Fechar visualizador"
                >
                  <X className="h-4 w-4" />
                </Button>
              </DialogPrimitive.Close>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-[#102f3d]">Onde esta foto pode ser usada</h3>
                <p className="mt-1 text-xs leading-relaxed text-[#5e7a85]">
                  Selecione uma ou mais opções. A escolha é salva imediatamente.
                </p>
              </div>

              <PhotoUsageSelector
                photo={photo}
                usageTypes={usageTypes}
                busy={busy}
                mode="panel"
                onToggle={(_, usage) => handleToggle(usage)}
              />

              {photo.usageSlugs.includes("oficial") && (
                <div className="mt-4 rounded-lg border border-[#9ccdd2] bg-[#e8f8f8] px-3 py-3">
                  <p className="text-xs font-semibold text-[#153f51]">Foto dos sistemas do escritório</p>
                  <p className="mt-1 text-xs leading-relaxed text-[#456370]">
                    Esta imagem aparece no seu avatar e no perfil NFC.
                  </p>
                </div>
              )}

              {actionError && (
                <div role="alert" className="mt-4 rounded-lg border border-destructive/35 bg-destructive/[0.08] px-3 py-2 text-xs text-destructive">
                  {actionError}
                </div>
              )}
            </div>

            <footer className="flex items-center gap-2 border-t border-[#dce9eb] bg-white px-4 py-3">
              <Button type="button" size="sm" className="flex-1" asChild>
                <a href={downloadHref(photo.id)}>
                  <Download className="h-4 w-4" />
                  Baixar original
                </a>
              </Button>
              {canDelete && onDelete && (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={busy}
                  onClick={() => {
                    void handleDeleteCurrent();
                  }}
                  aria-label="Excluir foto"
                  title="Excluir foto"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              )}
            </footer>
          </aside>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
