"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ImageIcon, ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { imageDisplayName, studioImageUrl } from "@/lib/estudio/images";
import { BACKGROUND_LAYER, type SlideBackground, type StudioSlide, type StudioTemplateDef } from "@/lib/estudio/types";
import { loadGallery, uploadImage } from "./field-form";

/**
 * Fundo do slide: automático (muda com a posição), uma das variações do Illustrator
 * ou uma foto (enviada ou da galeria) com a camada do tema por cima.
 */
export function BackgroundPanel({
  tag,
  template,
  slide,
  indice,
  others,
  onChange,
  onApplyAll,
}: {
  tag: string;
  template: StudioTemplateDef & { fundos: NonNullable<StudioTemplateDef["fundos"]> };
  slide: StudioSlide;
  indice: number;
  /** Outros slides com o mesmo modelo, que podem receber este fundo. */
  others: number;
  onChange: (fundo: SlideBackground | undefined, coalesceKey?: string) => void;
  onApplyAll: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [gallery, setGallery] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fundo = slide.fundo;
  const auto = (indice % template.fundos.variacoes) + 1;

  useEffect(() => {
    let alive = true;
    void loadGallery(tag, "fundos").then((paths) => alive && setGallery(paths));
    return () => {
      alive = false;
    };
  }, [tag]);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const path = await uploadImage(tag, "fundos", file);
      onChange({ tipo: "imagem", path, camada: BACKGROUND_LAYER.padrao });
      setGallery(await loadGallery(tag, "fundos", true));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar a imagem.");
    } finally {
      setBusy(false);
    }
  }

  const tile = (active: boolean) =>
    cn("relative block aspect-[4/5] w-full overflow-hidden border-2 transition", active ? "border-[#47cdd0]" : "border-transparent hover:border-black/20");

  return (
    <details className="group border border-black/[0.1] bg-white" open={Boolean(fundo) || undefined}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold">
        <span className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-[#347796]" aria-hidden /> Fundo
        </span>
        <span className="text-xs font-normal text-muted-foreground">
          {!fundo ? "Automático" : fundo.tipo === "variacao" ? `Variação ${fundo.n}` : "Foto"}
        </span>
      </summary>
      <div className="space-y-3 px-4 pb-4">
        <div className="grid grid-cols-4 gap-2">
          {[0, ...Array.from({ length: template.fundos.variacoes }, (_, i) => i + 1)].map((n) => {
            const active = n === 0 ? !fundo : fundo?.tipo === "variacao" && fundo.n === n;
            return (
              <button key={n} type="button" className={tile(active)} onClick={() => onChange(n === 0 ? undefined : { tipo: "variacao", n })} title={n === 0 ? "Muda com a posição do slide" : `Variação ${n}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={template.fundos.previa(n === 0 ? auto : n, slide.valores)} alt="" className="h-full w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 bg-white/85 py-0.5 text-center text-[10px] font-medium text-[#04202f]">{n === 0 ? "Auto" : n}</span>
              </button>
            );
          })}
        </div>

        {fundo?.tipo === "imagem" && (
          <div className="flex gap-3 border border-black/[0.08] bg-[#f7f9fa] p-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={studioImageUrl(fundo.path)} alt="" className="h-20 w-16 shrink-0 object-cover" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <label className="block space-y-1">
                <span className="flex items-baseline justify-between text-xs font-medium">
                  Camada por cima da foto
                  <span className="tabular-nums text-muted-foreground">{Math.round(fundo.camada * 100)}%</span>
                </span>
                <input
                  type="range"
                  min={BACKGROUND_LAYER.min}
                  max={BACKGROUND_LAYER.max}
                  step={0.01}
                  value={fundo.camada}
                  onChange={(e) => onChange({ ...fundo, camada: Number(e.target.value) }, `fundo:${slide.id}`)}
                  onDoubleClick={() => onChange({ ...fundo, camada: BACKGROUND_LAYER.padrao })}
                  className="w-full accent-[#04202f]"
                />
              </label>
              <p className="truncate text-[11px] text-muted-foreground" title={fundo.credito ?? imageDisplayName(fundo.path)}>
                {fundo.credito ?? imageDisplayName(fundo.path)}
              </p>
            </div>
            <button type="button" onClick={() => onChange(undefined)} className="self-start p-1 text-muted-foreground hover:text-destructive" aria-label="Tirar a foto de fundo" title="Tirar a foto">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 border border-black/[0.12] bg-white px-2.5 py-1 text-xs font-medium hover:border-[#347796]/50 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />} Enviar foto
          </button>
        </div>
        {gallery.length > 0 && (
          <select
            value=""
            onChange={(e) => e.target.value && onChange({ tipo: "imagem", path: e.target.value, camada: fundo?.tipo === "imagem" ? fundo.camada : BACKGROUND_LAYER.padrao })}
            className="h-8 w-full rounded-md border border-input bg-white px-2 text-xs"
            aria-label="Escolher fundo da galeria"
          >
            <option value="">Fotos já usadas ({gallery.length})…</option>
            {gallery.map((path) => (
              <option key={path} value={path}>
                {imageDisplayName(path)}
              </option>
            ))}
          </select>
        )}
        {others > 0 && (
          <button type="button" onClick={onApplyAll} className="inline-flex items-center gap-1.5 text-xs font-medium text-[#347796] hover:text-[#04202f]">
            <Check className="h-3.5 w-3.5" /> Usar este fundo nos outros {others} {others === 1 ? "slide" : "slides"} de {template.nome.toLowerCase()}
          </button>
        )}
        {error && <p className="text-[11px] text-destructive">{error}</p>}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file);
          }}
        />
      </div>
    </details>
  );
}
