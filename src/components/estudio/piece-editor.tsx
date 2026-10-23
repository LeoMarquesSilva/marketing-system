"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight, Download, Eye, FileImage, FileText, Loader2, PenTool, Redo2, Send, Sparkles, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { moveItem, newId, newSlide, slideFileName, switchSlideTemplate } from "@/lib/estudio/domain";
import { createHistory, historyReducer, type History, type HistoryAction } from "@/lib/estudio/history";
import { getCollection, getTemplate, templatesFor } from "@/lib/estudio/templates";
import { ARTBOARD_SIZE, PIECE_FORMAT, PIECE_KIND_LABEL, PIECE_MAX_SLIDES, type StudioPiece, type StudioSlide } from "@/lib/estudio/types";
import { AdjustPanel } from "./adjust-panel";
import { FieldForm } from "./field-form";
import { downloadBlob, pngsToPdf, renderArtboardPng, zipBlobs } from "./export-png";
import { renderArtboardSvg } from "./export-svg";
import { InstagramPreview } from "./instagram-preview";
import { ScaledBox, SlideArtboard, slideSize } from "./slide-artboard";
import { SlideRail } from "./slide-rail";
import { SendToPlannerDialog } from "./send-to-planner-dialog";

interface Doc {
  titulo: string;
  slides: StudioSlide[];
  legenda: string;
}
type SaveState = "salvo" | "salvando" | "pendente" | "erro";

// destaque rápido no campo achado pelo clique na arte (classes listadas aqui para o Tailwind gerar)
const FLASH = ["ring-2", "ring-[#47cdd0]", "ring-offset-2"];

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

function fileBase(titulo: string) {
  return (titulo || "peca").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^\w-]+/g, "-").toLowerCase();
}

export function PieceEditor({ piece, onBack }: { piece: StudioPiece; onBack: () => void }) {
  const { profile } = useAuth();
  const [history, dispatch] = useReducer(
    historyReducer as (state: History<Doc>, action: HistoryAction<Doc>) => History<Doc>,
    piece,
    (p: StudioPiece) => createHistory<Doc>({ titulo: p.titulo, slides: p.slides, legenda: p.legenda })
  );
  const { titulo, slides, legenda } = history.present;
  const [requestId, setRequestId] = useState(piece.request_id);
  const [selectedRaw, setSelected] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("salvo");
  const [pedido, setPedido] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResumo, setAiResumo] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [estouros, setEstouros] = useState<number[]>([]);
  const thumbRefs = useRef<(HTMLDivElement | null)[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  const collection = getCollection(piece.tag);
  const options = useMemo(() => templatesFor(piece.tag, piece.tipo), [piece.tag, piece.tipo]);
  const maxSlides = PIECE_MAX_SLIDES[piece.tipo];
  const selected = Math.min(selectedRaw, slides.length - 1);
  const current = slides[selected];
  const currentTemplate = current ? getTemplate(current.modelo) : null;
  const artSize = ARTBOARD_SIZE[PIECE_FORMAT[piece.tipo]];
  const slideWord = piece.tipo === "stories" ? "Tela" : piece.tipo === "carrossel" ? "Slide" : "Arte";

  const commit = useCallback((next: Doc | ((doc: Doc) => Doc), key?: string) => {
    dispatch({ type: "set", next, key, at: Date.now() });
  }, []);
  const setSlides = useCallback(
    (update: (list: StudioSlide[]) => StudioSlide[], key?: string) => commit((doc) => ({ ...doc, slides: update(doc.slides) }), key),
    [commit]
  );
  const updateSlide = (index: number, next: StudioSlide, key?: string) => setSlides((list) => list.map((s, i) => (i === index ? next : s)), key);

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

  // atalhos: desfazer/refazer e setas entre slides (fora dos campos de texto)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || previewOpen || sendOpen) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        dispatch({ type: "redo" });
      } else if (!mod && e.key === "ArrowRight") {
        setSelected((s) => Math.min(s + 1, slides.length - 1));
      } else if (!mod && e.key === "ArrowLeft") {
        setSelected((s) => Math.max(s - 1, 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length, previewOpen, sendOpen]);

  // texto que não coube (FitColumn/FitText marcam data-estouro nas miniaturas)
  useEffect(() => {
    let alive = true;
    const check = () => {
      if (!alive) return;
      const found = thumbRefs.current
        .slice(0, slides.length)
        .map((node, i) => (node?.querySelector('[data-estouro="1"]') ? i : -1))
        .filter((i) => i >= 0);
      setEstouros((prev) => (prev.join() === found.join() ? prev : found));
    };
    const timer = setTimeout(check, 450);
    void document.fonts?.ready.then(() => setTimeout(check, 80));
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [slides]);

  function addSlide(templateId: string) {
    const template = getTemplate(templateId);
    if (!template || slides.length >= maxSlides) return;
    setSlides((list) => [...list, newSlide(template)]);
    setSelected(slides.length);
  }

  function duplicateSlide(index: number) {
    if (slides.length >= maxSlides) return;
    setSlides((list) => {
      const copy = { ...list[index], id: newId(), valores: structuredClone(list[index].valores) };
      return [...list.slice(0, index + 1), copy, ...list.slice(index + 1)];
    });
    setSelected(index + 1);
  }

  function removeSlide(index: number) {
    if (slides.length <= 1) return;
    setSlides((list) => list.filter((_, i) => i !== index));
    setSelected((s) => Math.max(0, Math.min(s, slides.length - 2)));
  }

  function moveSlide(from: number, to: number) {
    setSlides((list) => moveItem(list, from, to));
    setSelected(to);
  }

  /** Clique num elemento da arte: rola até o campo dele no painel e foca. */
  function focusField(e: MouseEvent) {
    const campo = (e.target as HTMLElement).closest("[data-campo]")?.getAttribute("data-campo");
    if (!campo || !panelRef.current) return;
    const input = panelRef.current.querySelector<HTMLElement>(`[data-campo-input="${CSS.escape(campo)}"]`);
    if (!input) return;
    input.scrollIntoView({ block: "center", behavior: "smooth" });
    input.focus({ preventScroll: true });
    input.classList.add(...FLASH);
    setTimeout(() => input.classList.remove(...FLASH), 1200);
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
      const nextSlides = body.slides as StudioSlide[];
      commit((doc) => ({ ...doc, slides: nextSlides, legenda: typeof body.legenda === "string" ? body.legenda : doc.legenda }));
      setAiResumo(`${body.resumo ?? "Peça ajustada."} (Ctrl+Z desfaz)`);
      setSelected((s) => Math.min(s, nextSlides.length - 1));
      setPedido("");
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "A IA não respondeu.");
    } finally {
      setAiBusy(false);
    }
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

  async function runExport(kind: "png" | "pdf" | "svg") {
    setExporting(kind);
    setAiError(null);
    try {
      const base = fileBase(titulo);
      if (kind === "svg") {
        const files: { name: string; blob: Blob }[] = [];
        for (let i = 0; i < slides.length; i++) {
          const node = thumbRefs.current[i];
          if (!node) throw new Error("A prévia ainda está carregando.");
          const { width, height } = slideSize(slides[i]);
          const svg = await renderArtboardSvg(node, width, height);
          files.push({ name: slideFileName(piece.tipo, i).replace(/\.png$/, ".svg"), blob: new Blob([svg], { type: "image/svg+xml" }) });
        }
        if (files.length === 1) downloadBlob(files[0].blob, `${base}.svg`);
        else downloadBlob(await zipBlobs(files), `${base}-illustrator.zip`);
        return;
      }
      const blobs = await renderFiles();
      if (kind === "pdf") downloadBlob(await pngsToPdf(blobs, titulo || "Peça"), `${base}.pdf`);
      else if (blobs.length === 1) downloadBlob(blobs[0], `${base}.png`);
      else downloadBlob(await zipBlobs(blobs.map((blob, i) => ({ name: slideFileName(piece.tipo, i), blob }))), `${base}.zip`);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Não foi possível baixar.");
    } finally {
      setExporting(null);
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
  const ratio = artSize.width / artSize.height;
  const previewWidth = `min(${piece.tipo === "stories" ? 420 : 560}px, calc((100vh - 250px) * ${ratio.toFixed(4)}), 100%)`;

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 pb-10">
      <header className="flex flex-col gap-3 border-b border-black/[0.08] pb-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} aria-label="Voltar para as peças">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#347796]">
              [{piece.tag}] · {PIECE_KIND_LABEL[piece.tipo]} · {slides.length} {slides.length === 1 ? "arte" : "artes"} ·{" "}
              <span className={cn("font-normal", saveState === "erro" ? "text-destructive" : "text-muted-foreground")}>{saveLabel}</span>
            </p>
            <Input
              value={titulo}
              onChange={(e) => commit((doc) => ({ ...doc, titulo: e.target.value }), "titulo")}
              maxLength={120}
              aria-label="Nome da peça"
              className="mt-1 h-9 w-[min(30rem,80vw)] border-transparent bg-transparent px-1 text-lg font-semibold shadow-none hover:border-input focus-visible:bg-white"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex">
            <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "undo" })} disabled={!history.past.length} aria-label="Desfazer (Ctrl+Z)" title="Desfazer (Ctrl+Z)">
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "redo" })} disabled={!history.future.length} aria-label="Refazer (Ctrl+Shift+Z)" title="Refazer (Ctrl+Shift+Z)">
              <Redo2 className="h-4 w-4" />
            </Button>
          </div>
          {requestId && (
            <Link href={`/planner?tarefa=${requestId}`} className="text-xs font-medium text-[#347796] underline underline-offset-2">
              Ver no planner
            </Link>
          )}
          <Button variant="outline" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-4 w-4" /> Prévia
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" disabled={Boolean(exporting)}>
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Baixar
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-1.5">
              {[
                { kind: "png" as const, icon: FileImage, label: slides.length > 1 ? "Imagens (ZIP de PNGs)" : "Imagem (PNG)", hint: "Para postar no Instagram" },
                { kind: "pdf" as const, icon: FileText, label: "PDF do carrossel", hint: "Para carrossel no LinkedIn" },
                { kind: "svg" as const, icon: PenTool, label: "Abrir no Illustrator", hint: "SVG editável, salva como .ai" },
              ].map((item) => (
                <button
                  key={item.kind}
                  type="button"
                  onClick={() => void runExport(item.kind)}
                  className="flex w-full items-start gap-2.5 rounded px-2.5 py-2 text-left hover:bg-black/[0.04]"
                >
                  <item.icon className="mt-0.5 h-4 w-4 text-[#347796]" aria-hidden />
                  <span>
                    <span className="block text-sm font-medium">{item.label}</span>
                    <span className="block text-xs text-muted-foreground">{item.hint}</span>
                  </span>
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <Button onClick={() => setSendOpen(true)}>
            <Send className="h-4 w-4" /> Enviar ao planner
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[140px_minmax(0,1fr)_380px] xl:grid-cols-[140px_minmax(0,1fr)_420px]">
        {/* trilho de slides */}
        <aside className="order-3 lg:order-1 lg:max-h-[calc(100vh-190px)] lg:overflow-y-auto lg:pr-1">
          <SlideRail
            slides={slides}
            selected={selected}
            tipo={piece.tipo}
            maxSlides={maxSlides}
            templates={options}
            estouros={estouros}
            thumbRefs={thumbRefs}
            onSelect={setSelected}
            onMove={moveSlide}
            onDuplicate={duplicateSlide}
            onRemove={removeSlide}
            onAdd={addSlide}
          />
        </aside>

        {/* IA + prévia */}
        <section className="order-1 min-w-0 space-y-4 lg:order-2" aria-label="Prévia">
          <div className="border border-[#47cdd0]/30 bg-[#04202f] p-3 text-white">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Textarea
                value={pedido}
                onChange={(e) => setPedido(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void askAi();
                }}
                rows={2}
                maxLength={2000}
                placeholder="Pedir à IA: troca o palco 2 para 10h30 · monta 3 slides com a programação da tarde · encurta o título"
                aria-label="Pedido para a IA"
                className="min-h-0 flex-1 resize-none border-white/15 bg-white/[0.06] text-sm text-white placeholder:text-white/45"
              />
              <Button onClick={() => void askAi()} disabled={aiBusy || pedido.trim().length < 3} className="sm:self-stretch">
                {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {aiBusy ? "Ajustando…" : "Ajustar"}
              </Button>
            </div>
            {aiResumo && <p className="mt-2 text-xs text-[#8ae5e6]">{aiResumo}</p>}
            {aiError && <p className="mt-2 text-xs text-red-300">{aiError}</p>}
          </div>

          {estouros.length > 0 && (
            <p className="flex items-start gap-2 border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              Texto não coube {estouros.length === 1 ? `no ${slideWord.toLowerCase()} ${estouros[0] + 1}` : `nos ${slideWord.toLowerCase()}s ${estouros.map((i) => i + 1).join(", ")}`}: encurte, diminua o texto em Ajustes finos ou peça à IA.
            </p>
          )}

          {current && (
            <div className="flex items-center justify-center gap-2 bg-[#e9edef] px-2 py-4 sm:px-4">
              <button
                type="button"
                onClick={() => setSelected(Math.max(0, selected - 1))}
                disabled={selected === 0}
                className="hidden rounded-full bg-white p-1.5 shadow disabled:opacity-30 sm:block"
                aria-label="Slide anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div
                className="cursor-pointer shadow-[0_18px_50px_rgba(4,32,47,0.25)]"
                style={{ width: previewWidth }}
                onClick={focusField}
                title="Clique num texto da arte para editar"
              >
                <ScaledBox artWidth={artSize.width} artHeight={artSize.height}>
                  <SlideArtboard slide={current} indice={selected} total={slides.length} tipo={piece.tipo} />
                </ScaledBox>
              </div>
              <button
                type="button"
                onClick={() => setSelected(Math.min(slides.length - 1, selected + 1))}
                disabled={selected >= slides.length - 1}
                className="hidden rounded-full bg-white p-1.5 shadow disabled:opacity-30 sm:block"
                aria-label="Próximo slide"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
          <p className="text-center text-xs text-muted-foreground">
            {slideWord} {selected + 1} de {slides.length} · clique num texto da arte para editar · ←/→ trocam de slide
          </p>
        </section>

        {/* painel de edição */}
        <section ref={panelRef} className="order-2 min-w-0 space-y-4 lg:order-3 lg:max-h-[calc(100vh-190px)] lg:overflow-y-auto lg:pr-1" aria-label="Campos da peça">
          {current && currentTemplate && (
            <div className="border border-black/[0.1] bg-white p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">
                  {slideWord} {selected + 1}
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
                      <option key={t.id} value={t.id}>
                        Modelo: {t.nome}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <FieldForm
                fields={currentTemplate.campos}
                values={current.valores}
                tag={piece.tag}
                onChange={(valores, path) => updateSlide(selected, { ...current, valores }, path ? `campo:${current.id}:${path}` : undefined)}
              />
            </div>
          )}

          {current && currentTemplate?.ajustes?.length ? (
            <AdjustPanel
              key={current.id}
              keys={currentTemplate.ajustes.filter((k) => !k.startsWith("foto") || Boolean(current.valores.foto))}
              value={current.ajustes}
              onChange={(ajustes) => updateSlide(selected, { ...current, ajustes }, `ajuste:${current.id}`)}
            />
          ) : null}

          {piece.tipo !== "stories" && (
            <label className="block border border-black/[0.1] bg-white p-4">
              <span className="mb-2 block text-sm font-semibold">Legenda</span>
              <Textarea
                value={legenda}
                onChange={(e) => commit((doc) => ({ ...doc, legenda: e.target.value }), "legenda")}
                rows={6}
                maxLength={5000}
                className="bg-white text-sm"
                placeholder="Legenda para publicar (vai para o checklist da tarefa)."
              />
            </label>
          )}
        </section>
      </div>

      {previewOpen && (
        <InstagramPreview open onOpenChange={setPreviewOpen} slides={slides} tipo={piece.tipo} legenda={legenda} perfil={collection?.perfil} />
      )}

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
