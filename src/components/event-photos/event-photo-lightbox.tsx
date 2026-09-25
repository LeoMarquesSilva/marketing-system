"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ImageOff,
  Loader2,
  Star,
  Trash2,
  UserX,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { eventPhotoDownloadUrl } from "@/lib/event-photos/api";
import { eventPhotoDownloadName } from "@/lib/event-photos/domain";
import type { EventPhoto } from "@/lib/event-photos/types";

interface EventPhotoLightboxProps {
  photos: EventPhoto[];
  index: number | null;
  albumSlug: string;
  albumTitle: string;
  coverPhotoId: string | null;
  canManage: boolean;
  busy: boolean;
  /** Fotos em que o usuário logado foi reconhecido. */
  myPhotoIds: Set<string>;
  /** Posição da foto no álbum completo (o filtro "minhas" muda o índice visível). */
  albumPositionOf: (photo: EventPhoto) => number;
  onIndexChange: (index: number | null) => void;
  onNotMe: (photo: EventPhoto) => void;
  onSetCover: (photo: EventPhoto) => void;
  onDelete: (photo: EventPhoto) => void;
}

const navButtonClass =
  "absolute top-1/2 h-11 w-11 -translate-y-1/2 border border-white/12 bg-[#03111a]/72 text-white shadow-lg backdrop-blur-md hover:bg-[#163643] hover:text-white disabled:opacity-20";

export function EventPhotoLightbox({
  photos,
  index,
  albumSlug,
  albumTitle,
  coverPhotoId,
  canManage,
  busy,
  myPhotoIds,
  albumPositionOf,
  onIndexChange,
  onNotMe,
  onSetCover,
  onDelete,
}: EventPhotoLightboxProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [imageState, setImageState] = useState<{ id: string; status: "ready" | "error" } | null>(null);
  const open = index !== null && index >= 0 && index < photos.length;
  const photo = open ? photos[index] : null;
  const status = photo && imageState?.id === photo.id ? imageState.status : "loading";
  const setStatus = (next: "ready" | "error") => photo && setImageState({ id: photo.id, status: next });
  const canPrev = open && index > 0;
  const canNext = open && index < photos.length - 1;

  const go = useCallback(
    (delta: number) => {
      if (index === null) return;
      const next = index + delta;
      if (next >= 0 && next < photos.length) onIndexChange(next);
    },
    [index, onIndexChange, photos.length]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        go(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, open]);

  // Pré-carrega a próxima foto para a navegação ficar instantânea.
  useEffect(() => {
    if (!open || !canNext) return;
    const upcoming = photos[index + 1];
    const img = new Image();
    img.src = upcoming.previewUrl ?? upcoming.publicUrl;
  }, [canNext, index, open, photos]);

  if (!photo || index === null) return null;
  const downloadName = eventPhotoDownloadName(albumSlug, albumPositionOf(photo), photo.originalFilename);
  const isCover = coverPhotoId === photo.id;
  const isMine = myPhotoIds.has(photo.id);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onIndexChange(null)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-[#02070a]/88 backdrop-blur-sm data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-[71] grid grid-rows-[auto_minmax(0,1fr)_auto] bg-transparent text-white outline-none sm:inset-4"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            closeRef.current?.focus();
          }}
        >
          <DialogPrimitive.Title className="sr-only">
            {albumTitle} — foto {index + 1} de {photos.length}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Visualização ampliada. Use as setas do teclado para navegar.
          </DialogPrimitive.Description>

          <header className="flex items-center gap-3 px-3 py-2.5 sm:px-1">
            <p className="min-w-0 flex-1 truncate text-sm text-white/80">
              <span className="font-medium text-white">{albumTitle}</span>
              <span className="ml-2 font-mono text-xs tabular-nums text-white/60">
                {index + 1} / {photos.length}
              </span>
              {isMine && (
                <span className="ml-2 rounded-full bg-[#47cdd0]/20 px-2 py-0.5 text-xs text-[#9fe7e9]">
                  Você aparece aqui
                </span>
              )}
            </p>
            <DialogPrimitive.Close asChild>
              <Button
                ref={closeRef}
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 text-white hover:bg-white/10 hover:text-white"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </Button>
            </DialogPrimitive.Close>
          </header>

          <section className="relative flex min-h-0 items-center justify-center overflow-hidden">
            {status === "loading" && (
              <div className="absolute inset-0 grid place-items-center text-white/70">
                <Loader2 className="h-6 w-6 animate-spin" aria-label="Carregando foto" />
              </div>
            )}
            {status === "error" ? (
              <div className="flex max-w-sm flex-col items-center px-6 text-center text-white/75">
                <ImageOff className="h-9 w-9 text-[#78cdd0]" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-white">A imagem não pôde ser exibida</p>
                <p className="mt-1 text-xs text-white/60">Você ainda pode baixar o arquivo original.</p>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={photo.id}
                src={photo.previewUrl ?? photo.publicUrl}
                alt={`${albumTitle} — foto ${index + 1}`}
                className="h-full w-full object-contain px-2 transition-opacity duration-200 sm:px-16"
                decoding="async"
                onLoad={() => setStatus("ready")}
                onError={() => setStatus("error")}
                style={{ opacity: status === "ready" ? 1 : 0 }}
              />
            )}

            {photos.length > 1 && (
              <>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className={`${navButtonClass} left-2 sm:left-3`}
                  disabled={!canPrev}
                  onClick={() => go(-1)}
                  aria-label="Foto anterior"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className={`${navButtonClass} right-2 sm:right-3`}
                  disabled={!canNext}
                  onClick={() => go(1)}
                  aria-label="Próxima foto"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </>
            )}
          </section>

          <footer className="flex flex-wrap items-center justify-center gap-2 px-3 py-3">
            <Button asChild size="sm" className="gap-1.5 bg-[#347796] text-white hover:bg-[#285f7a]">
              <a href={eventPhotoDownloadUrl(photo, downloadName)} download={downloadName}>
                <Download className="h-4 w-4" />
                Baixar original
              </a>
            </Button>
            {isMine && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="gap-1.5 text-white hover:bg-white/10 hover:text-white"
                disabled={busy}
                onClick={() => onNotMe(photo)}
              >
                <UserX className="h-4 w-4" />
                Não sou eu
              </Button>
            )}
            {canManage && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-white hover:bg-white/10 hover:text-white"
                  disabled={busy || isCover}
                  onClick={() => onSetCover(photo)}
                >
                  <Star className="h-4 w-4" fill={isCover ? "currentColor" : "none"} />
                  {isCover ? "Capa do álbum" : "Usar como capa"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-[#ff9b9b] hover:bg-white/10 hover:text-[#ffb4b4]"
                  disabled={busy}
                  onClick={() => onDelete(photo)}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Excluir
                </Button>
              </>
            )}
          </footer>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
