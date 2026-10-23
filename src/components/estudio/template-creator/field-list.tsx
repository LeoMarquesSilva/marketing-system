"use client";

import { ImagePlus, Trash2, TriangleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ImageDraft, TextDraft } from "./drafts";

const small = "h-8 w-full rounded-md border border-input bg-white px-2 text-xs";

function Num({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="space-y-0.5">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <Input type="number" step={step} value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(Number(e.target.value))} className="h-8 bg-white px-2 text-xs" />
    </label>
  );
}

const FONT_HINT: Record<TextDraft["fonteStatus"], string | null> = {
  ok: null,
  faltando: "Fonte do modelo ainda sem arquivo: envie em Fontes (até lá, Montserrat).",
  desconhecida: "Fonte não está no Estúdio: envie o arquivo em Fontes (até lá, Montserrat).",
};

/** Blocos de texto da prancheta (campo ou fixo) e as caixas de foto do modelo. */
export function FieldList({
  texts,
  images,
  selected,
  onSelect,
  onText,
  onImage,
  onAddImage,
  onRemoveImage,
}: {
  texts: TextDraft[];
  images: ImageDraft[];
  selected: string | null;
  onSelect: (id: string) => void;
  onText: (blockId: string, patch: Partial<TextDraft>) => void;
  onImage: (key: string, patch: Partial<ImageDraft>) => void;
  onAddImage: () => void;
  onRemoveImage: (key: string) => void;
}) {
  return (
    <div className="space-y-2">
      {texts.map((d) => {
        const open = selected === d.blockId;
        return (
          <div key={d.blockId} className={cn("border bg-white", open ? "border-[#47cdd0]" : "border-black/[0.1]")}>
            <div className="flex items-center gap-2 px-3 py-2">
              <input
                type="checkbox"
                checked={d.usar}
                onChange={(e) => onText(d.blockId, { usar: e.target.checked })}
                className="h-4 w-4 accent-[#04202f]"
                aria-label={`Usar "${d.exemplo.slice(0, 30)}" como campo`}
              />
              <button type="button" onClick={() => onSelect(d.blockId)} className="min-w-0 flex-1 text-left">
                <span className={cn("block truncate text-sm", d.usar ? "font-medium" : "text-muted-foreground")}>{d.usar ? d.label : "Fixo (fica na arte)"}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{d.exemplo.replace(/\n/g, " ")}</span>
              </button>
              {d.usar && FONT_HINT[d.fonteStatus] && <TriangleAlert className="h-4 w-4 shrink-0 text-amber-600" aria-label="Fonte faltando" />}
            </div>
            {open && d.usar && (
              <div className="space-y-2.5 border-t border-black/[0.06] px-3 py-3">
                <div className="grid grid-cols-[1fr_80px_70px] gap-2">
                  <label className="space-y-0.5">
                    <span className="text-[10px] text-muted-foreground">Nome do campo</span>
                    <Input value={d.label} onChange={(e) => onText(d.blockId, { label: e.target.value })} className="h-8 bg-white text-xs" />
                  </label>
                  <Num label="Máx. letras" value={d.max} onChange={(v) => onText(d.blockId, { max: Math.max(1, Math.round(v)) })} />
                  <Num label="Linhas" value={d.linhas} onChange={(v) => onText(d.blockId, { linhas: Math.max(1, Math.round(v)), h: Math.round(Math.max(1, Math.round(v)) * d.entrelinha * d.tamanho + 2) })} />
                </div>
                <label className="block space-y-0.5">
                  <span className="text-[10px] text-muted-foreground">Dica para a IA (opcional)</span>
                  <Input value={d.dica} onChange={(e) => onText(d.blockId, { dica: e.target.value })} placeholder="Ex.: pergunta curta que puxa o assunto" className="h-8 bg-white text-xs" />
                </label>
                <div className="grid grid-cols-4 gap-2">
                  <Num label="Tamanho" value={d.tamanho} step={0.5} onChange={(v) => onText(d.blockId, { tamanho: v })} />
                  <Num label="Mínimo" value={d.minimo} step={0.5} onChange={(v) => onText(d.blockId, { minimo: v })} />
                  <Num label="Entrelinha" value={d.entrelinha} step={0.05} onChange={(v) => onText(d.blockId, { entrelinha: v })} />
                  <label className="space-y-0.5">
                    <span className="text-[10px] text-muted-foreground">Cor</span>
                    <input type="color" value={d.cor} onChange={(e) => onText(d.blockId, { cor: e.target.value, corManual: true })} className="h-8 w-full cursor-pointer border border-input bg-white p-0.5" />
                  </label>
                </div>
                <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                  <label className="space-y-0.5">
                    <span className="text-[10px] text-muted-foreground">Alinhamento</span>
                    <select value={d.alinhamento} onChange={(e) => onText(d.blockId, { alinhamento: e.target.value as TextDraft["alinhamento"] })} className={small}>
                      <option value="left">Esquerda</option>
                      <option value="center">Centro</option>
                      <option value="right">Direita</option>
                      <option value="justify">Justificado</option>
                    </select>
                  </label>
                  <span className="space-y-0.5">
                    <span className="block text-[10px] text-muted-foreground">Fonte</span>
                    <span className="block truncate text-xs" title={`No .ai: ${d.fontePdf}`}>
                      {d.fonte.familia.replace(/^Estudio /, "")} {d.fonte.peso}
                    </span>
                  </span>
                  <label className="flex h-8 items-center gap-1.5 text-xs">
                    <input type="checkbox" checked={d.caixaAlta} onChange={(e) => onText(d.blockId, { caixaAlta: e.target.checked })} className="h-3.5 w-3.5 accent-[#04202f]" />
                    Caixa alta
                  </label>
                </div>
                {FONT_HINT[d.fonteStatus] && <p className="text-[11px] text-amber-700">{FONT_HINT[d.fonteStatus]}</p>}
                <div className="grid grid-cols-4 gap-2">
                  <Num label="X" value={d.x} onChange={(v) => onText(d.blockId, { x: v })} />
                  <Num label="Y" value={d.y} onChange={(v) => onText(d.blockId, { y: v })} />
                  <Num label="Largura" value={d.w} onChange={(v) => onText(d.blockId, { w: v })} />
                  <Num label="Altura" value={d.h} onChange={(v) => onText(d.blockId, { h: v })} />
                </div>
              </div>
            )}
          </div>
        );
      })}

      {images.map((d) => (
        <div key={d.key} className="space-y-2 border border-black/[0.1] bg-white px-3 py-2.5">
          <div className="flex items-center gap-2">
            <ImagePlus className="h-4 w-4 text-[#347796]" aria-hidden />
            <Input value={d.label} onChange={(e) => onImage(d.key, { label: e.target.value })} className="h-8 flex-1 bg-white text-xs" aria-label="Nome do campo de foto" />
            <button type="button" onClick={() => onRemoveImage(d.key)} className="p-1 text-muted-foreground hover:text-destructive" aria-label="Tirar a foto do modelo">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={d.pasta} onChange={(e) => onImage(d.key, { pasta: e.target.value === "logos" ? "logos" : "fotos" })} className={small} aria-label="Tipo de imagem">
              <option value="fotos">Foto de pessoa</option>
              <option value="logos">Logo</option>
            </select>
            <select value={d.ajuste} onChange={(e) => onImage(d.key, { ajuste: e.target.value === "cover" ? "cover" : "contain" })} className={small} aria-label="Encaixe">
              <option value="contain">Inteira na caixa</option>
              <option value="cover">Preenche a caixa</option>
            </select>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <Num label="X" value={d.x} onChange={(v) => onImage(d.key, { x: v })} />
            <Num label="Y" value={d.y} onChange={(v) => onImage(d.key, { y: v })} />
            <Num label="Largura" value={d.w} onChange={(v) => onImage(d.key, { w: v })} />
            <Num label="Altura" value={d.h} onChange={(v) => onImage(d.key, { h: v })} />
          </div>
        </div>
      ))}

      <button type="button" onClick={onAddImage} className="inline-flex items-center gap-1.5 text-xs font-medium text-[#347796] hover:text-[#04202f]">
        <ImagePlus className="h-3.5 w-3.5" /> Adicionar campo de foto ou logo
      </button>
    </div>
  );
}
