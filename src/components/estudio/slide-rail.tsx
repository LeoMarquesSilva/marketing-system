"use client";

import { useState, type MutableRefObject } from "react";
import { AlertTriangle, Copy, Plus, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { newSlide } from "@/lib/estudio/domain";
import type { PieceKind, StudioSlide, StudioTemplateDef } from "@/lib/estudio/types";
import { ScaledBox, SlideArtboard, slideSize } from "./slide-artboard";

const THUMB = 128;

/**
 * Miniaturas dos slides (são também os nós usados na exportação). Arrastar reordena;
 * duplicar e remover aparecem ao passar o mouse; o selo avisa texto que não coube.
 */
export function SlideRail({
  slides,
  selected,
  tipo,
  maxSlides,
  templates,
  estouros,
  thumbRefs,
  onSelect,
  onMove,
  onDuplicate,
  onRemove,
  onAdd,
}: {
  slides: StudioSlide[];
  selected: number;
  tipo: PieceKind;
  maxSlides: number;
  templates: StudioTemplateDef[];
  estouros: number[];
  thumbRefs: MutableRefObject<(HTMLDivElement | null)[]>;
  onSelect: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onDuplicate: (index: number) => void;
  onRemove: (index: number) => void;
  onAdd: (templateId: string) => void;
}) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const canReorder = slides.length > 1;

  return (
    <nav aria-label="Slides" className="flex gap-3 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
      {slides.map((slide, index) => {
        const size = slideSize(slide);
        const warn = estouros.includes(index);
        return (
          <div
            key={slide.id}
            draggable={canReorder}
            onDragStart={(e) => {
              setDragFrom(index);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              if (dragFrom === null) return;
              e.preventDefault();
              setDragOver(index);
            }}
            onDragLeave={() => setDragOver((v) => (v === index ? null : v))}
            onDrop={(e) => {
              e.preventDefault();
              if (dragFrom !== null && dragFrom !== index) onMove(dragFrom, index);
              setDragFrom(null);
              setDragOver(null);
            }}
            onDragEnd={() => {
              setDragFrom(null);
              setDragOver(null);
            }}
            className={cn("group relative shrink-0", dragFrom === index && "opacity-40")}
          >
            <div
              role="button"
              tabIndex={0}
              onClick={() => onSelect(index)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(index)}
              aria-label={`Slide ${index + 1}`}
              aria-current={index === selected}
              className={cn(
                "block cursor-pointer outline-offset-2 transition",
                index === selected ? "outline outline-2 outline-[#347796]" : "opacity-75 hover:opacity-100",
                dragOver === index && dragFrom !== index && "outline outline-2 outline-dashed outline-[#47cdd0]",
                canReorder && "active:cursor-grabbing"
              )}
            >
              <ScaledBox width={THUMB} artWidth={size.width} artHeight={size.height}>
                <SlideArtboard ref={(el) => { thumbRefs.current[index] = el; }} slide={slide} indice={index} total={slides.length} tipo={tipo} />
              </ScaledBox>
            </div>
            <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-[10px] font-semibold tabular-nums text-white">{index + 1}</span>
            {warn && (
              <span className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded bg-amber-500 px-1 text-[10px] font-semibold text-white" title="Texto não coube neste slide">
                <AlertTriangle className="h-3 w-3" aria-hidden /> texto
              </span>
            )}
            {tipo !== "feed" && (
              <span className="absolute right-1 top-1 hidden gap-0.5 group-hover:flex group-focus-within:flex">
                <button type="button" disabled={slides.length >= maxSlides} onClick={() => onDuplicate(index)} className="rounded bg-white/90 p-1 text-[#04202f] shadow disabled:opacity-40" aria-label={`Duplicar slide ${index + 1}`}>
                  <Copy className="h-3 w-3" />
                </button>
                <button type="button" disabled={slides.length <= 1} onClick={() => onRemove(index)} className="rounded bg-white/90 p-1 text-destructive shadow disabled:opacity-40" aria-label={`Remover slide ${index + 1}`}>
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
        );
      })}

      {slides.length < maxSlides && templates.length > 0 && (
        <Popover open={addOpen} onOpenChange={setAddOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex shrink-0 flex-col items-center justify-center gap-1 border border-dashed border-black/20 text-xs font-medium text-[#347796] hover:border-[#347796] hover:bg-[#347796]/5"
              style={{ width: THUMB, minHeight: 72 }}
            >
              <Plus className="h-4 w-4" /> Slide
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto max-w-[min(92vw,560px)] p-3">
            <p className="mb-2 text-xs font-semibold">Adicionar slide</p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {templates.map((template) => {
                const sample = newSlide(template);
                const size = slideSize(sample);
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => {
                      onAdd(template.id);
                      setAddOpen(false);
                    }}
                    className="space-y-1 text-left text-[11px] hover:opacity-90"
                  >
                    <span className="block border border-black/10">
                      <ScaledBox width={104} artWidth={size.width} artHeight={size.height}>
                        <SlideArtboard slide={sample} indice={1} total={3} tipo={tipo} />
                      </ScaledBox>
                    </span>
                    <span className="block font-medium">{template.nome}</span>
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </nav>
  );
}
