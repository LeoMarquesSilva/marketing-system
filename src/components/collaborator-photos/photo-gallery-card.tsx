"use client";

import { useState } from "react";
import { Check, Download, Expand, ImageOff, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhotoUsageSelector } from "@/components/collaborator-photos/photo-usage-selector";
import { collaboratorPhotoPreviewUrl } from "@/lib/collaborator-photos/preview-url";
import { cn } from "@/lib/utils";
import type { CollaboratorPhoto, PhotoUsageType } from "@/lib/collaborator-photos/types";

interface PhotoGalleryCardProps {
  photo: CollaboratorPhoto;
  photoIndex: number;
  usageTypes: PhotoUsageType[];
  busy: boolean;
  canDelete: boolean;
  selected: boolean;
  onOpen: (photoId: string) => void;
  onToggleSelect: (photoId: string) => void;
  onDownload: (photo: CollaboratorPhoto) => void;
  onToggleUsage: (photo: CollaboratorPhoto, usage: PhotoUsageType) => void | Promise<void>;
  onDelete?: (photo: CollaboratorPhoto) => boolean | void | Promise<boolean | void>;
}

function gridPreviewSrc(publicUrl: string) {
  return collaboratorPhotoPreviewUrl(publicUrl, {
    width: 480,
    quality: 76,
    resize: "contain",
  });
}

export function PhotoGalleryCard({
  photo,
  photoIndex,
  usageTypes,
  busy,
  canDelete,
  selected,
  onOpen,
  onToggleSelect,
  onDownload,
  onToggleUsage,
  onDelete,
}: PhotoGalleryCardProps) {
  const [failedPreviewUrl, setFailedPreviewUrl] = useState<string | null>(null);
  const previewFailed = failedPreviewUrl === photo.publicUrl;
  const isOfficial = photo.usageSlugs.includes("oficial");
  const primaryLabel = photo.sessionLabel || photo.originalFilename || "Foto da sessão";

  return (
    <article
      className={cn(
        "group overflow-hidden rounded-lg border bg-white shadow-[0_1px_2px_rgba(3,32,47,0.05)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-18px_rgba(3,32,47,0.55)]",
        selected
          ? "border-[#47cdd0] ring-2 ring-[#47cdd0]/35"
          : isOfficial
            ? "border-[#64b9c3]"
            : "border-[#dce9eb] hover:border-[#a9cdd2]"
      )}
    >
      <div className="relative">
        <button
          type="button"
          className="relative block aspect-[3/4] w-full overflow-hidden bg-[#eaf1f2] text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#47cdd0]"
          onClick={() => onOpen(photo.id)}
          aria-label={`Abrir ${primaryLabel}`}
        >
          {previewFailed ? (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-xs text-[#5a747f]">
              <ImageOff className="h-6 w-6 text-[#73939c]" aria-hidden="true" />
              Não foi possível carregar a prévia
            </span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={gridPreviewSrc(photo.publicUrl)}
              alt={photo.originalFilename || "Foto da sessão"}
              className="h-full w-full object-contain object-center transition-transform duration-300 group-hover:scale-[1.015]"
              loading="lazy"
              decoding="async"
              onError={() => setFailedPreviewUrl(photo.publicUrl)}
            />
          )}

          <span className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#03131d]/55 to-transparent" aria-hidden="true" />

          {isOfficial && (
            <span className="absolute inset-x-2 top-2 rounded-md border border-white/35 bg-[#e8f8f8]/95 px-1.5 py-1 text-center text-xs font-semibold leading-4 text-[#153f51] shadow-sm backdrop-blur-sm">
              Foto dos sistemas
            </span>
          )}

          <span
            className="absolute inset-x-2 bottom-2 truncate text-xs font-medium text-white drop-shadow-sm"
            data-tour={photoIndex === 0 ? "mf-session" : undefined}
          >
            {primaryLabel}
          </span>
        </button>

        <button
          type="button"
          className={cn(
            "absolute left-2 z-10 grid h-7 w-7 place-items-center rounded-md border shadow-sm transition-colors",
            isOfficial ? "top-12" : "top-2",
            selected
              ? "border-[#2a9aa3] bg-[#47cdd0] text-[#0b2f3a]"
              : "border-white/70 bg-white/90 text-[#347796] hover:bg-white"
          )}
          aria-pressed={selected}
          aria-label={selected ? `Desmarcar ${primaryLabel}` : `Selecionar ${primaryLabel}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleSelect(photo.id);
          }}
        >
          {selected ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
        </button>
      </div>

      <div className="border-t border-[#edf3f4] px-2 py-2">
        <PhotoUsageSelector
          photo={photo}
          usageTypes={usageTypes}
          busy={busy}
          firstCard={photoIndex === 0}
          onToggle={onToggleUsage}
        />
      </div>

      <div
        className="flex min-h-10 items-center border-t border-[#edf3f4] px-1.5 py-1"
        data-tour={photoIndex === 0 ? "mf-actions" : undefined}
      >
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="h-8 gap-1.5 px-2 text-xs"
          onClick={() => onOpen(photo.id)}
        >
          <Expand className="h-3.5 w-3.5" />
          Abrir
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="ml-auto h-8 w-8"
          title="Baixar foto"
          aria-label={`Baixar ${primaryLabel}`}
          disabled={busy}
          onClick={() => onDownload(photo)}
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
        {canDelete && onDelete && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
            title="Excluir foto"
            aria-label={`Excluir ${primaryLabel}`}
            disabled={busy}
            onClick={() => {
              void Promise.resolve(onDelete(photo)).catch(() => undefined);
            }}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </Button>
        )}
      </div>
    </article>
  );
}
