"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, FileArchive, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export type ArtSlideKind = "image" | "video" | "other";

export interface ArtSlide {
  id: string;
  url: string;
  name: string;
  kind: ArtSlideKind;
}

export function artSlideKind(contentType: string | null | undefined): ArtSlideKind {
  if (contentType?.startsWith("image/")) return "image";
  if (contentType?.startsWith("video/")) return "video";
  return "other";
}

/**
 * A arte como aparece no Instagram: slides em 4:5 (1080×1350) que se arrastam
 * para o lado, setas, pontinhos e contador — sem abrir aba nem baixar arquivo.
 * Arte em outro formato aparece inteira (sem corte) sobre fundo neutro.
 */
type ArtCarouselProps = {
  slides: ArtSlide[];
  /** Topo do "post" (ex.: quem pediu, área). */
  header?: React.ReactNode;
  className?: string;
  label?: string;
};

export function ArtCarousel(props: ArtCarouselProps) {
  // Trocou a lista (outro card, arquivo removido): recomeça do primeiro slide.
  const slidesKey = props.slides.map((slide) => slide.id).join("|");
  return <ArtCarouselTrack key={slidesKey} {...props} />;
}

function ArtCarouselTrack({ slides, header, className, label = "Arte" }: ArtCarouselProps) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const total = slides.length;

  const goTo = useCallback((next: number) => {
    const el = track.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(total - 1, next));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
  }, [total]);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  if (total === 0) return null;
  const current = slides[Math.min(index, total - 1)];

  return (
    <figure className={cn("overflow-hidden rounded-lg border border-[#dce9eb] bg-white", className)} aria-roledescription="carrossel" aria-label={label}>
      {header ? <div className="border-b border-[#eef4f5] px-3 py-2.5">{header}</div> : null}

      <div className="group relative">
        <div
          ref={track}
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") {
              event.preventDefault();
              goTo(index + 1);
            } else if (event.key === "ArrowLeft") {
              event.preventDefault();
              goTo(index - 1);
            }
          }}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#47cdd0]"
          style={{ scrollbarWidth: "none" }}
        >
          {slides.map((slide, position) => (
            <div
              key={slide.id}
              className="relative aspect-[4/5] w-full shrink-0 snap-center bg-slate-100"
              aria-roledescription="slide"
              aria-label={`${position + 1} de ${total}: ${slide.name}`}
            >
              {slide.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={slide.url}
                  alt={slide.name}
                  loading={position === 0 ? "eager" : "lazy"}
                  draggable={false}
                  className="absolute inset-0 h-full w-full select-none object-contain"
                />
              ) : slide.kind === "video" ? (
                <video src={slide.url} controls playsInline preload="metadata" className="absolute inset-0 h-full w-full bg-black object-contain" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-slate-600">
                  {/\.zip$/i.test(slide.name) ? <FileArchive className="size-9" aria-hidden /> : <FileText className="size-9" aria-hidden />}
                  <span className="line-clamp-2 text-sm font-medium">{slide.name}</span>
                  <a href={slide.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[#347796] underline-offset-2 hover:underline">
                    Abrir arquivo
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>

        {total > 1 ? (
          <>
            <span className="pointer-events-none absolute right-2.5 top-2.5 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold tabular-nums text-white">
              {index + 1}/{total}
            </span>
            {index > 0 ? (
              <button
                type="button"
                onClick={() => goTo(index - 1)}
                aria-label="Slide anterior"
                className="absolute left-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-md transition-opacity hover:bg-white sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              >
                <ChevronLeft className="size-5" aria-hidden />
              </button>
            ) : null}
            {index < total - 1 ? (
              <button
                type="button"
                onClick={() => goTo(index + 1)}
                aria-label="Próximo slide"
                className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-md transition-opacity hover:bg-white sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              >
                <ChevronRight className="size-5" aria-hidden />
              </button>
            ) : null}
          </>
        ) : null}
      </div>

      <figcaption className="flex items-center gap-3 px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-xs text-slate-500" title={current.name}>
          {current.name}
        </span>
        {total > 1 ? (
          <span className="flex items-center gap-1" role="tablist" aria-label="Slides">
            {slides.map((slide, position) => (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={position === index}
                aria-label={`Ir para o slide ${position + 1}`}
                onClick={() => goTo(position)}
                className={cn("size-1.5 rounded-full transition-colors", position === index ? "bg-[#347796]" : "bg-slate-300 hover:bg-slate-400")}
              />
            ))}
          </span>
        ) : null}
        <a
          href={current.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-w-0 flex-1 items-center justify-end gap-1 text-xs text-slate-500 hover:text-slate-800"
          aria-label={`Abrir ${current.name} em tamanho real`}
        >
          <ExternalLink className="size-3.5 shrink-0" aria-hidden />
          <span className="hidden sm:inline">Tamanho real</span>
        </a>
      </figcaption>
    </figure>
  );
}
