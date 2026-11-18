"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, ChevronLeft, ChevronRight, ExternalLink, Film, ImagePlus, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDuration, formatMegabytes, isVideoFile } from "@/lib/rh/boas-praticas/media";
import { mediaFilesFrom } from "@/lib/rh/boas-praticas/photos-client";
import {
  FEEDBACK_PHOTOS_MAX,
  FEEDBACK_VIDEOS_MAX,
  isFeedbackVideo,
  type FeedbackPhoto,
} from "@/lib/rh/boas-praticas/types";
import { cn } from "@/lib/utils";

/** Foto ou vídeo escolhido no formulário e ainda não enviado (vai junto ao salvar). */
export interface PendingPhoto {
  key: string;
  file: File;
  preview: string;
  video: boolean;
}

export function toPendingPhotos(files: File[]): PendingPhoto[] {
  return files.map((file) => ({
    key: crypto.randomUUID(),
    file,
    preview: URL.createObjectURL(file),
    video: isVideoFile(file),
  }));
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

/** Selo de vídeo sobre a miniatura: play no centro e duração no canto. */
function VideoBadge({ duration, compact = false }: { duration: number | null; compact?: boolean }) {
  const label = formatDuration(duration);
  return (
    <>
      <span
        className={cn(
          "absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white",
          compact ? "size-6" : "size-9"
        )}
        aria-hidden
      >
        <Play className={cn("translate-x-px fill-current", compact ? "size-3" : "size-4")} />
      </span>
      {label && !compact && (
        <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-xs font-medium tabular-nums text-white">
          {label}
        </span>
      )}
    </>
  );
}

/** Miniatura da foto ou do vídeo já enviado. */
function MediaThumb({ media, compact = false }: { media: FeedbackPhoto; compact?: boolean }) {
  if (!isFeedbackVideo(media)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={media.url} alt="" className="size-full object-cover" />;
  }
  return (
    <>
      {media.poster_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media.poster_url} alt="" className="size-full object-cover" />
      ) : (
        <span className="grid size-full place-items-center bg-[#10293a] text-white/70" aria-hidden>
          <Film className={compact ? "size-4" : "size-6"} />
        </span>
      )}
      <VideoBadge duration={media.duration_seconds} compact={compact} />
    </>
  );
}

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
          aria-label={`Ver ${isFeedbackVideo(photo) ? "vídeo" : "foto"} ${index + 1} de ${photos.length}`}
          className={cn(
            TILE,
            "group transition-shadow duration-150 hover:ring-[#3e84a8]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
          )}
        >
          <span className="block size-full transition-opacity duration-150 group-hover:opacity-90">
            <MediaThumb media={photo} />
          </span>
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------- visualizador */

/** Player do vídeo; avisa quando o navegador não toca o formato (ex.: HEVC do iPhone). */
function VideoPlayer({ media, index }: { media: FeedbackPhoto; index: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="flex max-w-sm flex-col items-center gap-2 px-6 text-center text-sm text-white/80">
        <Film className="size-8 text-white/60" aria-hidden />
        Este navegador não toca o formato deste vídeo. Use &quot;Abrir em nova aba&quot; para baixar e assistir no computador.
      </div>
    );
  }
  return (
    <video
      src={media.url}
      poster={media.poster_url ?? undefined}
      controls
      playsInline
      preload="metadata"
      aria-label={`Vídeo ${index + 1} da ocorrência`}
      onError={() => setFailed(true)}
      className="max-h-full max-w-full"
    />
  );
}

/** Foto ou vídeo em tamanho grande dentro do próprio modal (sem abrir outro por cima). */
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
      // Setas dentro do player avançam o vídeo; não trocam de arquivo.
      if ((event.target as HTMLElement | null)?.tagName === "VIDEO") return;
      if (event.key === "ArrowLeft" && photos.length > 1) onIndex((index - 1 + photos.length) % photos.length);
      if (event.key === "ArrowRight" && photos.length > 1) onIndex((index + 1) % photos.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, photos.length, onIndex]);

  if (!photo) return null;
  const video = isFeedbackVideo(photo);
  const taken = takenAtLabel(photo.taken_at);
  const duration = formatDuration(photo.duration_seconds);

  return (
    <div className="space-y-3 px-6 py-5">
      <Button type="button" variant="ghost" size="sm" className="-ml-2 gap-1.5" onClick={onClose}>
        <ArrowLeft className="size-4" />
        Voltar ao feedback
      </Button>
      <div className="relative flex h-[min(60dvh,520px)] items-center justify-center overflow-hidden rounded-md bg-[#0f1b24]">
        {video ? (
          <VideoPlayer key={photo.id} media={photo} index={index} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.url} alt={`Foto ${index + 1} da ocorrência`} className="max-h-full max-w-full object-contain" />
        )}
        {hasMany && (
          <>
            <button
              type="button"
              aria-label="Anterior"
              onClick={() => go(-1)}
              className="absolute left-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white transition-colors hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Próximo"
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
          {video ? "Vídeo" : "Foto"} {index + 1} de {photos.length}
          {video && duration ? ` · ${duration}` : ""}
          {video ? ` · ${formatMegabytes(photo.size_bytes)}` : ""}
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
              aria-label={`Ir para ${isFeedbackVideo(entry) ? "o vídeo" : "a foto"} ${position + 1}`}
              aria-current={position === index}
              onClick={() => onIndex(position)}
              className={cn(
                "relative size-14 shrink-0 overflow-hidden rounded-md ring-2 ring-offset-1 transition-opacity",
                position === index ? "ring-[#347796]" : "opacity-60 ring-transparent hover:opacity-100"
              )}
            >
              <MediaThumb media={entry} compact />
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
        const files = mediaFilesFrom(event.dataTransfer.files);
        if (files.length) onAdd(files);
      }}
    >
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {existing.map((photo) => (
          <div key={photo.id} className={TILE}>
            <MediaThumb media={photo} />
            <RemoveButton video={isFeedbackVideo(photo)} onClick={() => onRemoveExisting(photo.id)} />
          </div>
        ))}
        {pending.map((photo) => (
          <div key={photo.key} className={TILE}>
            {photo.video ? (
              <>
                {/* #t=0.5: o navegador mostra um quadro do começo em vez da tela preta. */}
                <video src={`${photo.preview}#t=0.5`} muted playsInline preload="metadata" className="size-full object-cover" />
                <VideoBadge duration={null} />
              </>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.preview} alt="" className="size-full object-cover" />
            )}
            <span className="absolute inset-x-1 bottom-1 rounded bg-black/55 px-1.5 py-0.5 text-center text-xs font-medium text-white">
              {photo.video ? `Novo · ${formatMegabytes(photo.file.size)}` : "Nova"}
            </span>
            <RemoveButton video={photo.video} onClick={() => onRemovePending(photo.key)} />
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
            {total ? "Mais fotos ou vídeos" : "Adicionar fotos ou vídeos"}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/mp4,video/quicktime,video/webm,.mov,.mp4,.m4v,.webm"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const files = mediaFilesFrom(event.target.files);
          if (files.length) onAdd(files);
          event.target.value = "";
        }}
      />
      <p className="text-xs text-muted-foreground">
        {total} de {FEEDBACK_PHOTOS_MAX} · até {FEEDBACK_VIDEOS_MAX} vídeos de 200 MB · arraste ou cole (Ctrl+V) para
        adicionar. Fotografe ou filme o local ou o objeto e evite rostos; a localização das fotos é apagada no envio.
      </p>
    </div>
  );
}

function RemoveButton({ video, onClick }: { video: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={video ? "Remover vídeo" : "Remover foto"}
      onClick={onClick}
      className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
    >
      <X className="size-4" />
    </button>
  );
}
