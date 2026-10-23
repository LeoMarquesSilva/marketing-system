"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, ChevronLeft, ChevronRight, ExternalLink, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { imageFilesFrom } from "@/lib/rh/boas-praticas/photos-client";
import { FEEDBACK_PHOTOS_MAX, type FeedbackPhoto } from "@/lib/rh/boas-praticas/types";
import { cn } from "@/lib/utils";

/** Foto escolhida no formulário e ainda não enviada (vai junto ao salvar). */
export interface PendingPhoto {
  key: string;
  file: File;
  preview: string;
}

export function toPendingPhotos(files: File[]): PendingPhoto[] {
  return files.map((file) => ({ key: crypto.randomUUID(), file, preview: URL.createObjectURL(file) }));
}

function takenAtLabel(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

const TILE = "relative aspect-square overflow-hidden rounded-md bg-[#eef3f5] ring-1 ring-inset ring-black/5";

/* ------------------------------------------------------------ galeria */

export function PhotoGallery({
  photos,
  loadingCount,
  error,
  onOpen,
}: {
  photos: FeedbackPhoto[] | null;
  /** Quantas miniaturas reservar enquanto os links carregam. */
  loadingCount: number;
  error: string | null;
  onOpen: (index: number) => void;
}) {
  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (photos === null) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-busy>
        {Array.from({ length: Math.min(loadingCount, 8) }, (_, index) => (
          <span key={index} className={cn(TILE, "animate-pulse")} />
        ))}
      </div>
    );
  }
  if (photos.length === 0) return null;
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {photos.map((photo, index) => (
        <button
          key={photo.id}
          type="button"
          onClick={() => onOpen(index)}
          aria-label={`Ver foto ${index + 1} de ${photos.length}`}
          className={cn(
            TILE,
            "group transition-shadow duration-150 hover:ring-[#3e84a8]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt="" className="size-full object-cover transition-opacity duration-150 group-hover:opacity-90" />
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------- visualizador */

/** Foto em tamanho grande dentro do próprio modal (sem abrir outro por cima). */
export function PhotoViewer({
  photos,
  index,
  onIndex,
  onClose,
}: {
  photos: FeedbackPhoto[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const photo = photos[Math.min(index, photos.length - 1)];
  const hasMany = photos.length > 1;
  const go = (delta: number) => onIndex((index + delta + photos.length) % photos.length);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowLeft" && photos.length > 1) onIndex((index - 1 + photos.length) % photos.length);
      if (event.key === "ArrowRight" && photos.length > 1) onIndex((index + 1) % photos.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, photos.length, onIndex]);

  if (!photo) return null;
  const taken = takenAtLabel(photo.taken_at);

  return (
    <div className="space-y-3 px-6 py-5">
      <Button type="button" variant="ghost" size="sm" className="-ml-2 gap-1.5" onClick={onClose}>
        <ArrowLeft className="size-4" />
        Voltar ao feedback
      </Button>
      <div className="relative flex h-[min(60dvh,520px)] items-center justify-center overflow-hidden rounded-md bg-[#0f1b24]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt={`Foto ${index + 1} da ocorrência`} className="max-h-full max-w-full object-contain" />
        {hasMany && (
          <>
            <button
              type="button"
              aria-label="Foto anterior"
              onClick={() => go(-1)}
              className="absolute left-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white transition-colors hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Próxima foto"
              onClick={() => go(1)}
              className="absolute right-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white transition-colors hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span className="tabular-nums">
          Foto {index + 1} de {photos.length}
          {taken ? ` · tirada em ${taken}` : ""}
        </span>
        <a
          href={photo.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 font-medium text-[#285f7a] hover:underline"
        >
          <ExternalLink className="size-4" />
          Abrir em nova aba
        </a>
      </div>
      {hasMany && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((entry, position) => (
            <button
              key={entry.id}
              type="button"
              aria-label={`Ir para a foto ${position + 1}`}
              aria-current={position === index}
              onClick={() => onIndex(position)}
              className={cn(
                "size-14 shrink-0 overflow-hidden rounded-md ring-2 ring-offset-1 transition-opacity",
                position === index ? "ring-[#347796]" : "opacity-60 ring-transparent hover:opacity-100"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={entry.url} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------- campo do formulário */

export function PhotoField({
  existing,
  pending,
  loading,
  onAdd,
  onRemoveExisting,
  onRemovePending,
}: {
  existing: FeedbackPhoto[];
  pending: PendingPhoto[];
  loading: boolean;
  onAdd: (files: File[]) => void;
  onRemoveExisting: (id: string) => void;
  onRemovePending: (key: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const total = existing.length + pending.length;
  const full = total >= FEEDBACK_PHOTOS_MAX;

  return (
    <div
      className={cn("space-y-2 rounded-md transition-colors", dragging && "bg-[#e8f8f8] ring-2 ring-[#47cdd0]/50")}
      onDragOver={(event) => {
        if (!Array.from(event.dataTransfer.types).includes("Files")) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const files = imageFilesFrom(event.dataTransfer.files);
        if (files.length) onAdd(files);
      }}
    >
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {existing.map((photo) => (
          <div key={photo.id} className={TILE}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="" className="size-full object-cover" />
            <RemoveButton onClick={() => onRemoveExisting(photo.id)} />
          </div>
        ))}
        {pending.map((photo) => (
          <div key={photo.key} className={TILE}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.preview} alt="" className="size-full object-cover" />
            <span className="absolute inset-x-1 bottom-1 rounded bg-black/55 px-1.5 py-0.5 text-center text-xs font-medium text-white">
              Nova
            </span>
            <RemoveButton onClick={() => onRemovePending(photo.key)} />
          </div>
        ))}
        {loading &&
          Array.from({ length: 2 }, (_, index) => <span key={`loading-${index}`} className={cn(TILE, "animate-pulse")} />)}
        {!full && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex aspect-square flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-[#3e84a8]/40 bg-white px-2 text-center text-xs font-medium text-[#285f7a] transition-colors",
              "hover:bg-[#f2f8f9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60"
            )}
          >
            {total ? <ImagePlus className="size-5" aria-hidden /> : <Camera className="size-5" aria-hidden />}
            {total ? "Mais fotos" : "Adicionar fotos"}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const files = imageFilesFrom(event.target.files);
          if (files.length) onAdd(files);
          event.target.value = "";
        }}
      />
      <p className="text-xs text-muted-foreground">
        {total} de {FEEDBACK_PHOTOS_MAX} · arraste ou cole (Ctrl+V) para adicionar. Fotografe o local ou o objeto e evite
        rostos; a localização da foto é apagada no envio.
      </p>
    </div>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Remover foto"
      onClick={onClick}
      className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
    >
      <X className="size-4" />
    </button>
  );
}
