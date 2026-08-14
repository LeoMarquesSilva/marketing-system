"use client";

import { useEffect, useState } from "react";
import { Download, Images, Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CollaboratorPhoto, PhotoUsageType } from "@/lib/collaborator-photos/types";

interface PhotoGalleryGridProps {
  photos: CollaboratorPhoto[];
  usageTypes: PhotoUsageType[];
  busyPhotoId?: string | null;
  canDelete?: boolean;
  emptyTitle: string;
  emptyDescription: string;
  onToggleUsage: (photo: CollaboratorPhoto, usage: PhotoUsageType) => void;
  onDelete?: (photo: CollaboratorPhoto) => void;
}

function downloadHref(photoId: string) {
  return `/api/collaborator-photos/${photoId}/download`;
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

  if (photos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#9ec5c8]/70 bg-[#f4fbfb] px-6 py-16 text-center">
        <Images className="mx-auto h-10 w-10 text-[#1a6b72]/50" />
        <p className="mt-3 text-sm font-semibold text-[#04202f]">{emptyTitle}</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-[#04202f]/65">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {photos.map((photo) => {
          const isOfficial = photo.usageSlugs.includes("oficial");
          const busy = busyPhotoId === photo.id;
          return (
            <article
              key={photo.id}
              className={cn(
                "overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgba(3,32,47,0.06)]",
                isOfficial ? "border-[#47cdd0] ring-1 ring-[#47cdd0]/40" : "border-[#dce9eb]"
              )}
            >
              <button
                type="button"
                className="relative aspect-[3/4] w-full bg-[#04202f] text-left"
                onClick={() => setOpened(photo)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.publicUrl}
                  alt={photo.originalFilename || "Foto da sessão"}
                  className="h-full w-full object-cover object-top"
                />
                {isOfficial && (
                  <span className="absolute left-3 top-3 rounded-full bg-[#47cdd0] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#04202f]">
                    Oficial
                  </span>
                )}
                {photo.sessionLabel && (
                  <span className="absolute bottom-3 left-3 right-3 truncate rounded-md bg-black/55 px-2 py-1 text-[10px] font-medium text-white">
                    {photo.sessionLabel}
                  </span>
                )}
              </button>
              <div className="space-y-0.5 px-3 pt-2">
                {photo.originalFilename && (
                  <p className="truncate text-[11px] text-[#04202f]/55">{photo.originalFilename}</p>
                )}
                {photo.sessionLabel && (
                  <p className="truncate text-[11px] font-medium text-[#1a6b72]">
                    {photo.sessionLabel}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 p-3">
                {usageTypes.map((usage) => {
                  const active = photo.usageSlugs.includes(usage.slug);
                  return (
                    <button
                      key={usage.id}
                      type="button"
                      disabled={busy}
                      onClick={() => onToggleUsage(photo, usage)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
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
              <div className="flex items-center gap-1 border-t border-[#edf4f5] px-2 py-2">
                <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" asChild>
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
                    className="ml-auto h-8 gap-1.5 text-xs text-destructive hover:text-destructive"
                    disabled={busy}
                    onClick={() => onDelete(photo)}
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={opened.publicUrl}
              alt={opened.originalFilename || "Foto da sessão"}
              className="max-h-[78vh] w-full object-contain"
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
                    onClick={() => onDelete(opened)}
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
