"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ExternalLink, ImageIcon, ImagePlus, Loader2, Search, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { imageDisplayName, studioImageUrl } from "@/lib/estudio/images";
import { BACKGROUND_LAYER, type SlideBackground, type StudioSlide, type StudioTemplateDef } from "@/lib/estudio/types";
import { loadGallery, uploadImage } from "./field-form";

interface PexelsResult {
  id: number;
  alt: string;
  thumb: string;
  cor: string | null;
  credito: string;
  pagina: string;
}

function PexelsDialog({ tag, open, onOpenChange, onPick }: { tag: string; open: boolean; onOpenChange: (v: boolean) => void; onPick: (fundo: SlideBackground) => void }) {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [page, setPage] = useState(1);
  const [photos, setPhotos] = useState<PexelsResult[]>([]);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!submitted) return;
    let alive = true;
    const controller = new AbortController();
    fetch(`/api/estudio/fundos/pexels?q=${encodeURIComponent(submitted)}&pagina=${page}`, { credentials: "include", signal: controller.signal })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error ?? "A busca falhou.");
        if (!alive) return;
        setPhotos((list) => (page === 1 ? body.photos : [...list, ...body.photos]));
        setMore(Boolean(body.mais));
        setError(body.photos.length || page > 1 ? null : "Nenhuma foto com esse termo.");
      })
      .catch((err) => alive && err.name !== "AbortError" && setError(err instanceof Error ? err.message : "A busca falhou."))
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
      controller.abort();
    };
  }, [submitted, page]);

  function search(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    setBusy(true);
    setPage(1);
    setSubmitted(q);
  }

  async function pick(photo: PexelsResult) {
    setImporting(photo.id);
    setError(null);
    try {
      const res = await fetch("/api/estudio/fundos/pexels", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag, id: photo.id }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Não foi possível trazer a foto.");
      void loadGallery(tag, "fundos", true);
      onPick({ tipo: "imagem", path: body.path, camada: BACKGROUND_LAYER.padrao, credito: body.credito });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível trazer a foto.");
    } finally {
      setImporting(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => importing === null && onOpenChange(v)}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Foto de fundo do Pexels</DialogTitle>
          <DialogDescription>
            Fotos grátis para uso comercial. A camada do tema vai por cima para o texto continuar legível; o crédito fica salvo no slide.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={search} className="flex gap-2">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ex.: escritório, contrato, agro, cidade à noite" className="h-9 bg-white pl-8" aria-label="Buscar foto" />
          </label>
          <button type="submit" disabled={busy || query.trim().length < 2} className="inline-flex h-9 items-center gap-1.5 bg-[#04202f] px-3 text-sm font-medium text-white disabled:opacity-50">
            {busy && page === 1 ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar
          </button>
        </form>
        {error && <p className="text-sm text-muted-foreground">{error}</p>}
        {photos.length > 0 && (
          <div className="max-h-[55vh] overflow-y-auto pr-1">
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map((photo) => (
                <li key={photo.id} className="group relative">
                  <button
                    type="button"
                    disabled={importing !== null}
                    onClick={() => void pick(photo)}
                    className="relative block aspect-[4/5] w-full overflow-hidden disabled:cursor-wait"
                    style={{ background: photo.cor ?? "#e9edef" }}
                    title={photo.alt || photo.credito}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.thumb} alt={photo.alt} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-[1.03]" />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4 text-left text-[10px] text-white opacity-0 transition group-hover:opacity-100">
                      {photo.credito}
                    </span>
                    {importing === photo.id && (
                      <span className="absolute inset-0 flex items-center justify-center bg-white/60">
                        <Loader2 className="h-6 w-6 animate-spin text-[#04202f]" />
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            {more && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  setPage((p) => p + 1);
                }}
                className="mx-auto mt-3 flex items-center gap-1.5 text-sm font-medium text-[#347796] hover:text-[#04202f] disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Mais fotos
              </button>
            )}
          </div>
        )}
        <a href="https://www.pexels.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          Fotos fornecidas pelo Pexels <ExternalLink className="h-3 w-3" />
        </a>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Fundo do slide: automático (muda com a posição), uma das variações do Illustrator
 * ou uma foto (enviada, da galeria ou do Pexels) com a camada do tema por cima.
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
  const [pexelsOpen, setPexelsOpen] = useState(false);
  const fundo = slide.fundo;
  const auto = (indice % template.fundos.variacoes) + 1;

  useEffect(() => {
    let alive = true;
    void loadGallery(tag, "fundos").then((paths) => alive && setGallery(paths));
    return () => {
      alive = false;
    };
  }, [tag, pexelsOpen]);

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
          <button
            type="button"
            onClick={() => setPexelsOpen(true)}
            className="inline-flex items-center gap-1.5 border border-black/[0.12] bg-white px-2.5 py-1 text-xs font-medium hover:border-[#347796]/50"
          >
            <Search className="h-3.5 w-3.5" /> Buscar no Pexels
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
      {pexelsOpen && <PexelsDialog tag={tag} open onOpenChange={setPexelsOpen} onPick={(f) => onChange(f)} />}
    </details>
  );
}
