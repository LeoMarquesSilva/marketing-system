"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Download, Loader2, Send, Sparkles, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { moveItem, newId, newSlide, slideFileName, switchSlideTemplate } from "@/lib/estudio/domain";
import { getTemplate, templatesFor } from "@/lib/estudio/templates";
import { ARTBOARD_SIZE, PIECE_FORMAT, PIECE_KIND_LABEL, PIECE_MAX_SLIDES, type StudioPiece, type StudioSlide } from "@/lib/estudio/types";
import { FieldForm } from "./field-form";
import { downloadBlob, renderArtboardPng, zipBlobs } from "./export-png";
import { ScaledBox, SlideArtboard, slideSize } from "./slide-artboard";
import { SendToPlannerDialog } from "./send-to-planner-dialog";

type Snapshot = { slides: StudioSlide[]; legenda: string };
type SaveState = "salvo" | "salvando" | "pendente" | "erro";

export function PieceEditor({ piece, onBack }: { piece: StudioPiece; onBack: () => void }) {
  const { profile } = useAuth();
  const [titulo, setTitulo] = useState(piece.titulo);
  const [slides, setSlides] = useState<StudioSlide[]>(piece.slides);
  const [legenda, setLegenda] = useState(piece.legenda);
  const [requestId, setRequestId] = useState(piece.request_id);
  const [selected, setSelected] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("salvo");
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [pedido, setPedido] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResumo, setAiResumo] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const thumbRefs = useRef<(HTMLDivElement | null)[]>([]);
  const firstRender = useRef(true);

  const options = useMemo(() => templatesFor(piece.tag, piece.tipo), [piece.tag, piece.tipo]);
  const maxSlides = PIECE_MAX_SLIDES[piece.tipo];
  const current = slides[Math.min(selected, slides.length - 1)];
  const currentTemplate = current ? getTemplate(current.modelo) : null;
  const artSize = ARTBOARD_SIZE[PIECE_FORMAT[piece.tipo]];

  // salvamento automático
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSaveState("pendente");
    const timer = setTimeout(async () => {
      setSaveState("salvando");
      try {
        const res = await fetch(`/api/estudio/pecas/${piece.id}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ titulo, slides, legenda }),
        });
        setSaveState(res.ok ? "salvo" : "erro");
      } catch {
        setSaveState("erro");
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [piece.id, titulo, slides, legenda]);

  const updateSlide = (index: number, next: StudioSlide) => setSlides((list) => list.map((s, i) => (i === index ? next : s)));

  function addSlide(templateId: string) {
    const template = getTemplate(templateId);
    if (!template || slides.length >= maxSlides) return;
    setSlides((list) => [...list, newSlide(template)]);
    setSelected(slides.length);
  }

  function duplicateSlide(index: number) {
    if (slides.length >= maxSlides) return;
    const copy = { ...slides[index], id: newId(), valores: structuredClone(slides[index].valores) };
    setSlides((list) => [...list.slice(0, index + 1), copy, ...list.slice(index + 1)]);
    setSelected(index + 1);
  }

  function removeSlide(index: number) {
    if (slides.length <= 1) return;
    setSlides((list) => list.filter((_, i) => i !== index));
    setSelected((s) => Math.max(0, Math.min(s, slides.length - 2)));
  }

  async function askAi() {
    if (pedido.trim().length < 3) return;
    setAiBusy(true);
    setAiError(null);
    setAiResumo(null);
    try {
      const res = await fetch("/api/estudio/ajustar", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: piece.tag, tipo: piece.tipo, titulo, slides, legenda, pedido }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "A IA não respondeu.");
      setHistory((h) => [...h.slice(-19), { slides, legenda }]);
      setSlides(body.slides as StudioSlide[]);
      if (typeof body.legenda === "string") setLegenda(body.legenda);
      setAiResumo(body.resumo ?? "Peça ajustada.");
      setSelected((s) => Math.min(s, (body.slides as StudioSlide[]).length - 1));
      setPedido("");
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "A IA não respondeu.");
    } finally {
      setAiBusy(false);
    }
  }

  function undo() {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    setSlides(last.slides);
    setLegenda(last.legenda);
    setAiResumo("Última mudança da IA desfeita.");
  }

  const renderFiles = useCallback(async () => {
    const blobs: Blob[] = [];
    for (let i = 0; i < slides.length; i++) {
      const node = thumbRefs.current[i];
      if (!node) throw new Error("A prévia ainda está carregando.");
      const { width, height } = slideSize(slides[i]);
      blobs.push(await renderArtboardPng(node, width, height));
    }
    return blobs;
  }, [slides]);

  async function download() {
    setExporting(true);
    try {
      const blobs = await renderFiles();
      const base = (titulo || "peca").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "-").toLowerCase();
      if (blobs.length === 1) downloadBlob(blobs[0], `${base}.png`);
      else downloadBlob(await zipBlobs(blobs.map((blob, i) => ({ name: slideFileName(piece.tipo, i), blob }))), `${base}.zip`);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Não foi possível baixar.");
    } finally {
      setExporting(false);
    }
  }

  async function onSent(id: string) {
    setRequestId(id);
    await fetch(`/api/estudio/pecas/${piece.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request_id: id }),
    }).catch(() => undefined);
  }

  const saveLabel = { salvo: "Salvo", salvando: "Salvando…", pendente: "Alterações não salvas", erro: "Erro ao salvar" }[saveState];
  const previewWidth = piece.tipo === "stories" ? 380 : 520;

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <header className="flex flex-col gap-4 border-b border-black/[0.08] pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} aria-label="Voltar para as peças">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#347796]">
              [{piece.tag}] · {PIECE_KIND_LABEL[piece.tipo]} · {slides.length} {slides.length === 1 ? "arte" : "artes"}
            </p>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={120}
              aria-label="Nome da peça"
              className="mt-1 h-9 w-[min(28rem,80vw)] border-transparent bg-transparent px-1 text-lg font-semibold shadow-none hover:border-input focus-visible:bg-white"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("text-xs", saveState === "erro" ? "text-destructive" : "text-muted-foreground")}>{saveLabel}</span>
          {requestId && (
            <Link href={`/planner?tarefa=${requestId}`} className="text-xs font-medium text-[#347796] underline underline-offset-2">
              Ver no planner
            </Link>
          )}
          <Button variant="outline" onClick={() => void download()} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {slides.length > 1 ? "Baixar ZIP" : "Baixar PNG"}
          </Button>
          <Button onClick={() => setSendOpen(true)}>
            <Send className="h-4 w-4" /> Enviar ao planner
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
        {/* coluna de edição */}
        <section className="space-y-5" aria-label="Campos da peça">
          <div className="border border-black/[0.1] bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{piece.tipo === "stories" ? "Telas" : piece.tipo === "carrossel" ? "Slides" : "Arte"}</h3>
              {slides.length < maxSlides && options.length > 0 && (
                <select
                  value=""
                  onChange={(e) => e.target.value && addSlide(e.target.value)}
                  className="h-8 rounded-md border border-input bg-white px-2 text-xs"
                  aria-label="Adicionar slide"
                >
                  <option value="">+ Adicionar…</option>
                  {options.map((t) => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </select>
              )}
            </div>
            <ol className="space-y-1">
              {slides.map((slide, index) => (
                <li key={slide.id}>
                  <div
                    className={cn(
                      "flex items-center gap-2 border px-2 py-1.5 text-sm",
                      index === selected ? "border-[#04202f] bg-[#04202f] text-white" : "border-transparent hover:bg-black/[0.03]"
                    )}
                  >
                    <button type="button" className="flex-1 truncate text-left" onClick={() => setSelected(index)}>
                      <span className="mr-2 tabular-nums opacity-60">{index + 1}</span>
                      {getTemplate(slide.modelo)?.nome ?? slide.modelo}
                    </button>
                    {piece.tipo !== "feed" && (
                      <span className="flex gap-0.5 opacity-80">
                        <button type="button" className="p-1 disabled:opacity-30" disabled={index === 0} onClick={() => { setSlides((l) => moveItem(l, index, index - 1)); setSelected(index - 1); }} aria-label="Subir"><ArrowUp className="h-3.5 w-3.5" /></button>
                        <button type="button" className="p-1 disabled:opacity-30" disabled={index === slides.length - 1} onClick={() => { setSlides((l) => moveItem(l, index, index + 1)); setSelected(index + 1); }} aria-label="Descer"><ArrowDown className="h-3.5 w-3.5" /></button>
                        <button type="button" className="p-1 disabled:opacity-30" disabled={slides.length >= maxSlides} onClick={() => duplicateSlide(index)} aria-label="Duplicar"><Copy className="h-3.5 w-3.5" /></button>
                        <button type="button" className="p-1 disabled:opacity-30" disabled={slides.length <= 1} onClick={() => removeSlide(index)} aria-label="Remover"><Trash2 className="h-3.5 w-3.5" /></button>
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {current && currentTemplate && (
            <div className="border border-black/[0.1] bg-white p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">
                  {piece.tipo === "feed" ? "Campos" : `${piece.tipo === "stories" ? "Tela" : "Slide"} ${selected + 1}`}
                </h3>
                {options.length > 1 && (
                  <select
                    value={current.modelo}
                    onChange={(e) => {
                      const t = getTemplate(e.target.value);
                      if (t) updateSlide(selected, switchSlideTemplate(current, t));
                    }}
                    className="h-8 rounded-md border border-input bg-white px-2 text-xs"
                    aria-label="Modelo do slide"
                  >
                    {options.map((t) => (
                      <option key={t.id} value={t.id}>Modelo: {t.nome}</option>
                    ))}
                  </select>
                )}
              </div>
              <FieldForm
                fields={currentTemplate.campos}
                values={current.valores}
                onChange={(valores) => updateSlide(selected, { ...current, valores })}
              />
            </div>
          )}

          {piece.tipo !== "stories" && (
            <label className="block border border-black/[0.1] bg-white p-4">
              <span className="mb-2 block text-sm font-semibold">Legenda</span>
              <Textarea value={legenda} onChange={(e) => setLegenda(e.target.value)} rows={5} maxLength={5000} className="bg-white text-sm" placeholder="Legenda para publicar (vai para o checklist da tarefa)." />
            </label>
          )}
        </section>

        {/* coluna da prévia */}
        <section className="space-y-5" aria-label="Prévia">
          <div className="border border-[#47cdd0]/30 bg-[#04202f] p-4 text-white">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-xs font-semibold text-[#8ae5e6]">
                <Sparkles className="h-3.5 w-3.5" aria-hidden /> PEDIR À IA
              </span>
              {history.length > 0 && (
                <button type="button" onClick={undo} className="inline-flex items-center gap-1 text-xs text-white/70 hover:text-white">
                  <Undo2 className="h-3.5 w-3.5" /> Desfazer
                </button>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Textarea
                value={pedido}
                onChange={(e) => setPedido(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void askAi();
                }}
                rows={2}
                maxLength={2000}
                placeholder="Ex.: troca o palco 2 para 10h30 · monta 3 slides com a programação da tarde · encurta o título"
                className="min-h-0 flex-1 resize-none border-white/15 bg-white/[0.06] text-sm text-white placeholder:text-white/40"
              />
              <Button onClick={() => void askAi()} disabled={aiBusy || pedido.trim().length < 3} className="sm:self-stretch">
                {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {aiBusy ? "Ajustando…" : "Ajustar"}
              </Button>
            </div>
            {aiResumo && <p className="mt-2 text-xs text-[#8ae5e6]">{aiResumo}</p>}
            {aiError && <p className="mt-2 text-xs text-red-300">{aiError}</p>}
          </div>

          {current && (
            <div className="flex justify-center bg-[#e9edef] p-3 sm:p-5">
              <div className="w-full shadow-[0_18px_50px_rgba(4,32,47,0.25)]" style={{ maxWidth: previewWidth }}>
                <ScaledBox artWidth={artSize.width} artHeight={artSize.height}>
                  <SlideArtboard slide={current} indice={selected} total={slides.length} tipo={piece.tipo} />
                </ScaledBox>
              </div>
            </div>
          )}

          {slides.length > 1 && (
            <ol className="flex flex-wrap gap-3" aria-label="Todas as artes">
              {slides.map((slide, index) => (
                <li key={slide.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(index)}
                    className={cn("block outline-offset-2", index === selected ? "outline outline-2 outline-[#347796]" : "opacity-80 hover:opacity-100")}
                    aria-label={`Abrir ${index + 1}`}
                  >
                    <ScaledBox width={110} artWidth={artSize.width} artHeight={artSize.height}>
                      <SlideArtboard ref={(el) => { thumbRefs.current[index] = el; }} slide={slide} indice={index} total={slides.length} tipo={piece.tipo} />
                    </ScaledBox>
                  </button>
                </li>
              ))}
            </ol>
          )}
          {/* peça de uma arte só: o nó de exportação fica fora da tela */}
          {slides.length === 1 && (
            <div aria-hidden style={{ position: "fixed", left: -20000, top: 0, pointerEvents: "none" }}>
              <SlideArtboard ref={(el) => { thumbRefs.current[0] = el; }} slide={slides[0]} indice={0} total={1} tipo={piece.tipo} />
            </div>
          )}
        </section>
      </div>

      {sendOpen && (
        <SendToPlannerDialog
          open
          onOpenChange={setSendOpen}
          tag={piece.tag}
          kind={piece.tipo}
          titulo={titulo}
          slides={slides}
          legenda={legenda}
          linkedRequestId={requestId}
          user={profile ? { id: profile.id, name: profile.name } : null}
          renderFiles={renderFiles}
          onSent={(id) => void onSent(id)}
        />
      )}
    </div>
  );
}
