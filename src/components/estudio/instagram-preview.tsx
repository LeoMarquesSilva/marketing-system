"use client";

import { useEffect, useState } from "react";
import { Bookmark, ChevronLeft, ChevronRight, Heart, MessageCircle, Send } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { PieceKind, StudioSlide } from "@/lib/estudio/types";
import { ScaledBox, SlideArtboard, slideSize } from "./slide-artboard";

const PHONE_WIDTH = 360;

/** Como a peça aparece no feed/stories: deslizar entre os slides, bolinhas e legenda. */
export function InstagramPreview({
  open,
  onOpenChange,
  slides,
  tipo,
  legenda,
  perfil,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slides: StudioSlide[];
  tipo: PieceKind;
  legenda: string;
  perfil?: { nome: string; foto?: string };
}) {
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const current = slides[Math.min(index, slides.length - 1)];
  const size = current ? slideSize(current) : { width: 1080, height: 1350 };
  const story = tipo === "stories";
  const name = perfil?.nome ?? "perfil";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, slides.length - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, slides.length]);

  if (!current) return null;
  const caption = legenda.trim();
  const short = caption.length > 110 && !expanded ? `${caption.slice(0, 110).trimEnd()}…` : caption;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-auto max-w-none border-0 bg-transparent p-0 shadow-none">
        <DialogTitle className="sr-only">Prévia no Instagram</DialogTitle>
        <DialogDescription className="sr-only">Use as setas para passar os slides.</DialogDescription>
        <div className="overflow-hidden rounded-[2.2rem] border-[10px] border-[#111] bg-white text-[#111] shadow-2xl" style={{ width: PHONE_WIDTH + 20 }}>
          {!story && (
            <div className="flex items-center gap-2.5 px-3 py-2.5">
              <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#0d1e2e] ring-2 ring-[#d5b071]">
                {perfil?.foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={perfil.foto} alt="" className="h-6 w-6 object-contain" />
                ) : (
                  <span className="text-xs font-semibold text-white">{name[0]?.toUpperCase()}</span>
                )}
              </span>
              <span className="text-[13px] font-semibold">{name}</span>
            </div>
          )}

          <div className="relative bg-black">
            <ScaledBox width={PHONE_WIDTH} artWidth={size.width} artHeight={size.height}>
              <SlideArtboard slide={current} indice={index} total={slides.length} tipo={tipo} />
            </ScaledBox>
            {story && (
              <div className="absolute inset-x-2 top-2 flex gap-1">
                {slides.map((s, i) => (
                  <span key={s.id} className={cn("h-0.5 flex-1 rounded-full", i <= index ? "bg-white" : "bg-white/40")} />
                ))}
              </div>
            )}
            {index > 0 && (
              <button type="button" onClick={() => setIndex(index - 1)} className="absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-[#111] shadow" aria-label="Slide anterior">
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            {index < slides.length - 1 && (
              <button type="button" onClick={() => setIndex(index + 1)} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-[#111] shadow" aria-label="Próximo slide">
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>

          {!story && (
            <div className="space-y-2 px-3 pb-4 pt-2.5">
              <div className="flex items-center">
                <div className="flex flex-1 gap-3.5">
                  <Heart className="h-[22px] w-[22px]" />
                  <MessageCircle className="h-[22px] w-[22px]" />
                  <Send className="h-[22px] w-[22px]" />
                </div>
                {slides.length > 1 && (
                  <div className="flex flex-1 justify-center gap-1">
                    {slides.map((s, i) => (
                      <span key={s.id} className={cn("h-1.5 w-1.5 rounded-full", i === index ? "bg-[#0095f6]" : "bg-black/20")} />
                    ))}
                  </div>
                )}
                <div className="flex flex-1 justify-end">
                  <Bookmark className="h-[22px] w-[22px]" />
                </div>
              </div>
              {caption && (
                <p className="whitespace-pre-line text-[13px] leading-snug">
                  <span className="font-semibold">{name}</span> {short}
                  {short !== caption && (
                    <button type="button" onClick={() => setExpanded(true)} className="ml-1 text-black/50">
                      mais
                    </button>
                  )}
                </p>
              )}
            </div>
          )}
        </div>
        <p className="mt-3 text-center text-xs text-white/80">
          {index + 1} de {slides.length} · setas do teclado passam os slides
        </p>
      </DialogContent>
    </Dialog>
  );
}
