"use client";

/* eslint-disable react-hooks/set-state-in-effect -- Fecha o lightbox quando a foto aberta é removida da coleção. */

import { useEffect, useState } from "react";
import { Download, Expand, Images, Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { collaboratorPhotoPreviewUrl } from "@/lib/collaborator-photos/preview-url";
import type { CollaboratorPhoto, PhotoUsageType } from "@/lib/collaborator-photos/types";

interface PhotoGalleryGridProps {
  photos: CollaboratorPhoto[];
  usageTypes: PhotoUsageType[];
  busyPhotoId?: string | null;
  canDelete?: boolean;
  emptyTitle: string;
  emptyDescription: string;
  onToggleUsage: (photo: CollaboratorPhoto, usage: PhotoUsageType) => void;
  onDelete?: (photo: CollaboratorPhoto) => void | Promise<void>;
}

function downloadHref(photoId: string) {
  return `/api/collaborator-photos/${photoId}/download`;
}

/** Preview leve do card — sem crop agressivo (contain). */
function gridPreviewSrc(publicUrl: string) {
  return collaboratorPhotoPreviewUrl(publicUrl, {
    width: 360,
    quality: 70,
    resize: "contain",
  });
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
  const [opened, setOpened] = useState<CollaboratorPhoto | null>(null);

  useEffect(() => {
    if (!opened) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpened(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [opened]);

  useEffect(() => {
    if (opened && !photos.some((photo) => photo.id === opened.id)) {
      setOpened(null);
    }
  }, [opened, photos]);

  // Assim que a exclusão começa (após o confirm), fecha o lightbox para não
  // mostrar a imagem já removida do Storage até o reload.
  useEffect(() => {
    if (opened && busyPhotoId === opened.id) {
      setOpened(null);
    }
  }, [busyPhotoId, opened]);

  if (photos.length === 0) {
    return (
      <div
        className="rounded-2xl border border-dashed border-[#9ec5c8]/70 bg-[#f4fbfb] px-6 py-16 text-center"
        data-tour="mf-gallery"
      >
        <Images className="mx-auto h-10 w-10 text-[#1a6b72]/50" />
        <p className="mt-3 text-sm font-semibold text-[#04202f]">{emptyTitle}</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-[#04202f]/65">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <>
      <div
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
        data-tour="mf-gallery"
      >
        {photos.map((photo, photoIndex) => {
          const isOfficial = photo.usageSlugs.includes("oficial");
          const busy = busyPhotoId === photo.id;
          return (
            <article
              key={photo.id}
              className={cn(
                "overflow-hidden rounded-xl border bg-white shadow-[0_1px_2px_rgba(3,32,47,0.06)]",
                isOfficial ? "border-[#47cdd0] ring-1 ring-[#47cdd0]/40" : "border-[#dce9eb]"
              )}
            >
              <div className="relative aspect-[3/4] max-h-48 w-full bg-[#e8f2f3]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={gridPreviewSrc(photo.publicUrl)}
                  alt={photo.originalFilename || "Foto da sessão"}
                  className="h-full w-full object-contain object-center"
                  loading="lazy"
                  decoding="async"
                />
                {isOfficial && (
                  <span className="absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-[#47cdd0] px-2 py-0.5 text-[9px] font-semibold tracking-wide text-[#04202f]">
                    Sistemas do escritório
                  </span>
                )}
                {photo.sessionLabel && (
                  <span
                    className="absolute bottom-2 left-2 right-2 truncate rounded-md bg-black/55 px-1.5 py-0.5 text-[9px] font-medium text-white"
                    data-tour={photoIndex === 0 ? "mf-session" : undefined}
                  >
                    {photo.sessionLabel}
                  </span>
                )}
              </div>
              <div className="space-y-0.5 px-2.5 pt-1.5">
                {photo.originalFilename && (
                  <p className="truncate text-[10px] text-[#04202f]/55">{photo.originalFilename}</p>
                )}
                {photo.sessionLabel && (
                  <p className="truncate text-[10px] font-medium text-[#1a6b72]">
                    {photo.sessionLabel}
                  </p>
                )}
              </div>
              <div
                className="flex flex-wrap gap-1 px-2.5 py-2"
                data-tour={photoIndex === 0 ? "mf-usage-options" : undefined}
              >
                {usageTypes.map((usage) => {
                  const active = photo.usageSlugs.includes(usage.slug);
                  return (
                    <button
                      key={usage.id}
                      type="button"
                      disabled={busy}
                      onClick={() => onToggleUsage(photo, usage)}
                      data-tour={
                        photoIndex === 0 && usage.slug === "oficial"
                          ? "mf-official-usage"
                          : undefined
                      }
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                        active
                          ? usage.isOfficial
                            ? "border-[#04202f] bg-[#04202f] text-white"
                            : "border-[#1a6b72] bg-[#1a6b72] text-white"
                          : "border-[#dce9eb] bg-white text-[#04202f]/70 hover:border-[#47cdd0] hover:text-[#04202f]"
                      )}
                    >
                      {usage.label}
                    </button>
                  );
                })}
              </div>
              <div
                className="flex items-center gap-0.5 border-t border-[#edf4f5] px-1.5 py-1.5"
                data-tour={photoIndex === 0 ? "mf-actions" : undefined}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-[11px]"
                  onClick={() => setOpened(photo)}
                >
                  <Expand className="h-3.5 w-3.5" />
                  Abrir
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[11px]" asChild>
                  <a href={downloadHref(photo.id)}>
                    <Download className="h-3.5 w-3.5" />
                    Baixar
                  </a>
                </Button>
                {canDelete && onDelete && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-7 gap-1 px-2 text-[11px] text-destructive hover:text-destructive"
                    disabled={busy}
                    onClick={() => onDelete?.(photo)}
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Excluir
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {opened && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#04202f]/80 p-4 backdrop-blur-sm"
          onClick={() => setOpened(null)}
        >
          <div
            className="relative max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-black shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Qualidade original — sem transformação do Storage. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={opened.publicUrl}
              alt={opened.originalFilename || "Foto da sessão"}
              className="max-h-[78vh] w-full object-contain"
              decoding="async"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 bg-[#04202f] px-4 py-3 text-white">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {opened.originalFilename || "Foto da sessão"}
                </p>
                {opened.sessionLabel && (
                  <p className="truncate text-xs text-[#47cdd0]">{opened.sessionLabel}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 gap-1.5 bg-[#47cdd0] text-[#04202f] hover:bg-[#47cdd0]/90"
                  asChild
                >
                  <a href={downloadHref(opened.id)}>
                    <Download className="h-3.5 w-3.5" />
                    Baixar
                  </a>
                </Button>
                {canDelete && onDelete && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1.5 text-white hover:bg-white/10 hover:text-white"
                    disabled={busyPhotoId === opened.id}
                    onClick={() => onDelete?.(opened)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir
                  </Button>
                )}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-white hover:bg-white/10 hover:text-white"
                  onClick={() => setOpened(null)}
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
