"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { ArrowLeft, Check, FileUp, Layers, Loader2, Plus, Save, Wand2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { fieldKey } from "@/lib/estudio/dynamic";
import type { StudioFontRow } from "@/lib/estudio/fonts";
import { slugifyFileName } from "@/lib/estudio/images";
import { cleanArtboard } from "@/lib/estudio/pdf-artboard";
import { groupTextBlocks, type TextBlock } from "@/lib/estudio/pdf-text";
import { allCollections, templatesFor } from "@/lib/estudio/templates";
import { ARTBOARD_SIZE, PIECE_KIND_LABEL, type PieceKind, type StudioTemplateDef } from "@/lib/estudio/types";
import { uploadImage } from "../field-form";
import { ScaledBox } from "../slide-artboard";
import { DynamicSlide } from "../templates/dynamic";
import { loadStudioRegistry, useStudioRegistry } from "../use-studio-registry";
import { draftsFromBlocks, draftsToBoxes, type ImageDraft, type SlotInfo, type TextDraft } from "./drafts";
import { FieldList } from "./field-list";
import { artboardShape, canvasToBlob, measureTextColor, openPdf, readTextRuns, renderPage, zonesFor } from "./pdf-source";
import { TemplatesManager } from "./templates-manager";

interface Artboard {
  index: number;
  formato: "feed" | "story";
  scale: number;
  blocks: TextBlock[];
  original: HTMLCanvasElement;
  originalUrl: string;
}

interface Preview {
  canvas: HTMLCanvasElement;
  blob: Blob;
  url: string;
}

const card = "border border-black/[0.1] bg-white p-5";
const primary = "inline-flex items-center gap-1.5 bg-[#04202f] px-3 py-2 text-sm font-medium text-white disabled:opacity-50";

function NewCollection({ onCreated }: { onCreated: (tag: string) => void }) {
  const [tag, setTag] = useState("");
  const [nome, setNome] = useState("");
  const [contexto, setContexto] = useState("");
  const [planner, setPlanner] = useState<"tag" | "posts">("tag");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/estudio/colecoes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: tag.trim().toUpperCase(), nome, contexto, planner }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Não foi possível criar a coleção.");
      await loadStudioRegistry(true);
      onCreated(body.colecao.tag);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a coleção.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-3 border border-[#47cdd0]/40 bg-[#47cdd0]/[0.05] p-4">
      <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
        <label className="space-y-1">
          <span className="text-xs font-medium">Tag</span>
          <Input value={tag} onChange={(e) => setTag(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))} placeholder="AGRO" className="h-9 bg-white" />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium">Nome</span>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Campanha do Agro 2027" className="h-9 bg-white" />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-xs font-medium">Contexto para a IA</span>
        <Textarea value={contexto} onChange={(e) => setContexto(e.target.value)} rows={3} placeholder="Datas, local, público, tom da campanha… A IA só usa o que estiver aqui ou na peça." className="bg-white text-sm" />
      </label>
      <fieldset className="flex flex-wrap gap-4 text-sm">
        <legend className="mb-1 text-xs font-medium">No planner</legend>
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={planner === "tag"} onChange={() => setPlanner("tag")} className="accent-[#04202f]" /> Tarefas com [TAG] no título
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={planner === "posts"} onChange={() => setPlanner("posts")} className="accent-[#04202f]" /> Tarefas de post em aberto
        </label>
      </fieldset>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button type="button" disabled={busy || tag.length < 2 || nome.trim().length < 2} onClick={() => void create()} className={primary}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Criar coleção
      </button>
    </div>
  );
}

/** Miniaturas das pranchetas, desenhadas uma de cada vez. */
function ArtboardPicker({ pdf, onPick, busyIndex }: { pdf: PDFDocumentProxy; onPick: (index: number) => void; busyIndex: number | null }) {
  const [thumbs, setThumbs] = useState<Record<number, string>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      for (let i = 0; i < pdf.numPages && alive; i++) {
        const page = await pdf.getPage(i + 1);
        const canvas = await renderPage(page, 150, "#ffffff");
        if (!alive) return;
        const url = canvas.toDataURL("image/jpeg", 0.8);
        setThumbs((t) => ({ ...t, [i]: url }));
      }
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [pdf]);

  return (
    <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
      {Array.from({ length: pdf.numPages }, (_, i) => (
        <li key={i}>
          <button
            type="button"
            onClick={() => onPick(i)}
            disabled={busyIndex !== null}
            className="group relative block w-full border border-black/[0.1] bg-[#eef1f3] transition hover:border-[#347796] disabled:cursor-wait"
          >
            {thumbs[i] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbs[i]} alt={`Prancheta ${i + 1}`} className="block w-full" />
            ) : (
              <span className="flex aspect-[4/5] items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </span>
            )}
            <span className="absolute left-1 top-1 bg-white/90 px-1 text-[10px] font-semibold">{i + 1}</span>
            {busyIndex === i && (
              <span className="absolute inset-0 flex items-center justify-center bg-white/70">
                <Loader2 className="h-5 w-5 animate-spin text-[#04202f]" />
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Tela Modelos: cria um modelo novo a partir de uma prancheta do .ai, sem código.
 * Tudo acontece no navegador (o .ai não sobe): textos viram campos, o fundo limpo é
 * gerado aqui e só ele vai para o bucket.
 */
export function TemplateCreator() {
  const router = useRouter();
  const ready = useStudioRegistry();
  const [version, setVersion] = useState(0);
  const [tag, setTag] = useState("");
  const [newCollection, setNewCollection] = useState(false);

  const [fonts, setFonts] = useState<StudioFontRow[]>([]);
  const [slots, setSlots] = useState<SlotInfo[]>([]);

  const fileRef = useRef<HTMLInputElement>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState("");
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [opening, setOpening] = useState(false);
  const [picking, setPicking] = useState<number | null>(null);
  const [artboard, setArtboard] = useState<Artboard | null>(null);

  const [texts, setTexts] = useState<TextDraft[]>([]);
  const [images, setImages] = useState<ImageDraft[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [uso, setUso] = useState<PieceKind[]>(["carrossel"]);

  const [preview, setPreview] = useState<Preview | null>(null);
  const [generating, setGenerating] = useState(false);
  const [overlay, setOverlay] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // o registro é de módulo: `version` muda depois de cada carga e redesenha a lista
  const collections = ready ? allCollections() : [];
  const dynamicTemplates: StudioTemplateDef[] = (() => {
    if (!ready || !tag) return [];
    const all = (["feed", "carrossel", "stories"] as PieceKind[]).flatMap((k) => templatesFor(tag, k, { incluirInativos: true }));
    return all.filter((t, i) => t.layout && all.findIndex((o) => o.id === t.id) === i);
  })();

  useEffect(() => {
    if (ready && !tag) setTag(allCollections()[0]?.tag ?? "");
  }, [ready, tag]);

  useEffect(() => {
    fetch("/api/estudio/fontes", { credentials: "include", cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!body) return;
        setFonts(body.fonts);
        setSlots(body.slots);
      })
      .catch(() => undefined);
  }, []);

  // o preview usa URL de objeto: solta quando troca
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview]
  );

  const refresh = useCallback(async () => {
    await loadStudioRegistry(true);
    setVersion((v) => v + 1);
  }, []);

  async function openFile(file: File) {
    setOpening(true);
    setError(null);
    setArtboard(null);
    setPreview(null);
    setSaved(null);
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      const doc = await openPdf(data);
      setBytes(data);
      setPdf(doc);
      setFileName(file.name);
    } catch {
      setError("Não deu para abrir o arquivo. No Illustrator, salve o .ai com “Criar arquivo compatível com PDF” ligado, ou exporte em PDF.");
    } finally {
      setOpening(false);
    }
  }

  async function pickArtboard(index: number) {
    if (!pdf) return;
    setPicking(index);
    setError(null);
    setPreview(null);
    setSaved(null);
    try {
      const page = await pdf.getPage(index + 1);
      const shape = artboardShape(page);
      if (!shape.formato) {
        setError(`Esta prancheta não é 4:5 (post) nem 9:16 (story) — a proporção é 1:${shape.ratio.toFixed(2)}.`);
        return;
      }
      const { runs, scale } = await readTextRuns(page);
      const original = await renderPage(page, 1080, "#ffffff");
      const blocks = groupTextBlocks(runs, 1080);
      setArtboard({ index, formato: shape.formato, scale, blocks, original, originalUrl: original.toDataURL("image/jpeg", 0.85) });
      setTexts(draftsFromBlocks(blocks, fonts, slots));
      setImages([]);
      setSelected(null);
      setUso(shape.formato === "story" ? ["stories"] : ["carrossel"]);
      setNome(`${fileName.replace(/\.[a-z0-9]+$/i, "")} ${index + 1}`.slice(0, 60));
      if (blocks.length === 0) setError("Nenhum texto editável nesta prancheta (o texto pode estar em contornos). Ainda dá para criar campos de foto.");
    } catch (err) {
      console.error(err);
      setError("Não foi possível ler esta prancheta.");
    } finally {
      setPicking(null);
    }
  }

  function patchText(blockId: string, patch: Partial<TextDraft>) {
    setPreview(null);
    setTexts((list) =>
      list.map((d) => {
        if (d.blockId !== blockId) return d;
        const next = { ...d, ...patch };
        if (patch.label !== undefined) {
          const taken = new Set(list.filter((o) => o.blockId !== blockId).map((o) => o.key));
          for (const img of images) taken.add(img.key);
          next.key = fieldKey(patch.label, taken);
        }
        return next;
      })
    );
  }

  function addImage() {
    if (!artboard) return;
    const { width, height } = ARTBOARD_SIZE[artboard.formato];
    const taken = new Set([...texts.map((d) => d.key), ...images.map((d) => d.key)]);
    const key = fieldKey("Foto", taken);
    setPreview(null);
    setImages((list) => [...list, { key, label: "Foto", pasta: "fotos", ajuste: "contain", x: Math.round(width * 0.55), y: Math.round(height * 0.45), w: Math.round(width * 0.42), h: Math.round(height * 0.55) }]);
  }

  async function generate() {
    if (!artboard || !bytes) return;
    setGenerating(true);
    setError(null);
    try {
      const used = texts.filter((d) => d.usar);
      const zones = artboard.blocks.filter((b) => used.some((d) => d.blockId === b.id)).flatMap((b) => zonesFor(b.runs, artboard.scale));
      const { pdf: cleanedPdf } = await cleanArtboard(bytes, artboard.index, zones);
      const cleanedDoc = await openPdf(cleanedPdf);
      const canvas = await renderPage(await cleanedDoc.getPage(1), 1080, "#ffffff");
      void cleanedDoc.destroy();
      // cor de cada campo medida na diferença entre a prancheta e o fundo limpo
      setTexts((list) =>
        list.map((d) => {
          if (!d.usar || d.corManual) return d;
          const color = measureTextColor(artboard.original, canvas, { x: d.x, y: d.y, w: d.w, h: d.h });
          return color ? { ...d, cor: color } : d;
        })
      );
      let blob = await canvasToBlob(canvas, "image/png");
      if (blob.size > 8 * 1024 * 1024) blob = await canvasToBlob(canvas, "image/jpeg", 0.92);
      setPreview({ canvas, blob, url: URL.createObjectURL(blob) });
      setOverlay(0);
    } catch (err) {
      console.error(err);
      setError("Não foi possível gerar o fundo limpo desta prancheta.");
    } finally {
      setGenerating(false);
    }
  }

  async function save() {
    if (!artboard || !preview) return;
    setSaving(true);
    setError(null);
    try {
      const ext = preview.blob.type === "image/jpeg" ? "jpg" : "png";
      const fundo = await uploadImage(tag, "modelos", new File([preview.blob], `${slugifyFileName(nome)}.${ext}`, { type: preview.blob.type }));
      const res = await fetch("/api/estudio/modelos", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag, nome: nome.trim(), descricao: descricao.trim(), formato: artboard.formato, uso, fundo, caixas: draftsToBoxes(texts, images) }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Não foi possível salvar o modelo.");
      await refresh();
      setSaved(`“${nome.trim()}” salvo: já aparece em [${tag}] no Estúdio.`);
      setArtboard(null);
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o modelo.");
    } finally {
      setSaving(false);
    }
  }

  const boxes = useMemo(() => draftsToBoxes(texts, images), [texts, images]);
  const exemplo = useMemo(() => Object.fromEntries(boxes.map((b) => [b.key, b.exemplo])), [boxes]);
  const size = artboard ? ARTBOARD_SIZE[artboard.formato] : ARTBOARD_SIZE.feed;
  const canSave = Boolean(preview && nome.trim().length >= 2 && uso.length && boxes.length && tag);
  const missingFonts = texts.filter((d) => d.usar && d.fonteStatus !== "ok");

  if (!ready) {
    return (
      <div className="flex items-center gap-2 py-20 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando os modelos…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <section className="flex flex-col gap-3 border-b border-black/[0.08] pb-5">
        <button type="button" onClick={() => router.push("/conteudo/estudio")} className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Estúdio
        </button>
        <div>
          <div className="mb-1 flex items-center gap-2 text-[#347796]">
            <Layers className="h-4 w-4" aria-hidden />
            <span className="text-xs font-semibold">Modelos</span>
          </div>
          <h2 className="text-2xl font-semibold">Subir modelo novo</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Abra o .ai (ou PDF), escolha a prancheta e marque quais textos viram campos. O Estúdio apaga esses textos do fundo, mede posição, fonte, cor e tamanho, e o modelo passa a funcionar como os outros: IA, ajustes, PNG e planner.
          </p>
        </div>
      </section>

      <section className={card}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1">
            <span className="text-xs font-semibold">Coleção</span>
            <select value={tag} onChange={(e) => setTag(e.target.value)} className="h-9 min-w-64 rounded-md border border-input bg-white px-2 text-sm">
              {collections.map((c) => (
                <option key={c.tag} value={c.tag}>
                  [{c.tag}] {c.nome}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => setNewCollection((v) => !v)} className="inline-flex h-9 items-center gap-1.5 border border-black/[0.12] bg-white px-3 text-sm font-medium hover:border-[#347796]/50">
            <Plus className="h-4 w-4" /> Nova coleção
          </button>
        </div>
        {newCollection && (
          <NewCollection
            onCreated={(created) => {
              setVersion((v) => v + 1);
              setTag(created);
              setNewCollection(false);
            }}
          />
        )}
        <div className="mt-5">
          <h3 className="mb-2 text-sm font-semibold">Modelos criados aqui</h3>
          <TemplatesManager key={`${tag}-${version}`} templates={dynamicTemplates} onChanged={refresh} />
        </div>
      </section>

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">1. Arquivo do Illustrator</h3>
            <p className="text-xs text-muted-foreground">O arquivo é lido aqui no navegador; só o fundo limpo da prancheta escolhida é enviado.</p>
          </div>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={opening} className={primary}>
            {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} {pdf ? "Trocar arquivo" : "Abrir .ai ou PDF"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".ai,.pdf,application/pdf,application/postscript,application/illustrator"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void openFile(file);
            }}
          />
        </div>
        {pdf && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-muted-foreground">
              {fileName} · {pdf.numPages} {pdf.numPages === 1 ? "prancheta" : "pranchetas"}. Escolha uma:
            </p>
            <ArtboardPicker pdf={pdf} onPick={(i) => void pickArtboard(i)} busyIndex={picking} />
          </div>
        )}
      </section>

      {saved && (
        <p className="flex items-center gap-2 border border-emerald-600/30 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <Check className="h-4 w-4" /> {saved}
        </p>
      )}
      {error && <p className="border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}

      {artboard && (
        <section className={cn(card, "space-y-5")}>
          <div>
            <h3 className="text-sm font-semibold">2. Campos da prancheta {artboard.index + 1}</h3>
            <p className="text-xs text-muted-foreground">Marcados viram campos (o texto sai do fundo); desmarcados ficam fixos na arte. Clique num texto da prancheta para ajustar.</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
            <div className="relative w-full self-start border border-black/[0.1]" style={{ aspectRatio: `${size.width} / ${size.height}` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={artboard.originalUrl} alt={`Prancheta ${artboard.index + 1}`} className="absolute inset-0 h-full w-full" />
              {texts.map((d) => (
                <button
                  key={d.blockId}
                  type="button"
                  onClick={() => setSelected(d.blockId)}
                  title={d.usar ? d.label : "Fixo"}
                  className={cn(
                    "absolute border-2 transition",
                    d.usar ? "border-[#47cdd0] bg-[#47cdd0]/10" : "border-dashed border-black/30",
                    selected === d.blockId && "ring-2 ring-[#04202f]"
                  )}
                  style={{ left: `${(d.x / size.width) * 100}%`, top: `${(d.y / size.height) * 100}%`, width: `${(d.w / size.width) * 100}%`, height: `${(d.h / size.height) * 100}%` }}
                />
              ))}
              {images.map((d) => (
                <span
                  key={d.key}
                  className="pointer-events-none absolute border-2 border-dashed border-[#347796] bg-[#347796]/10"
                  style={{ left: `${(d.x / size.width) * 100}%`, top: `${(d.y / size.height) * 100}%`, width: `${(d.w / size.width) * 100}%`, height: `${(d.h / size.height) * 100}%` }}
                />
              ))}
            </div>

            <div className="min-w-0 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-medium">Nome do modelo</span>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} className="h-9 bg-white" />
                </label>
                <fieldset className="space-y-1">
                  <legend className="text-xs font-medium">Serve para</legend>
                  <div className="flex flex-wrap gap-3 pt-1.5 text-sm">
                    {(artboard.formato === "story" ? (["stories"] as PieceKind[]) : (["feed", "carrossel"] as PieceKind[])).map((k) => (
                      <label key={k} className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={uso.includes(k)}
                          onChange={(e) => setUso((list) => (e.target.checked ? [...list, k] : list.filter((u) => u !== k)))}
                          className="h-4 w-4 accent-[#04202f]"
                        />
                        {PIECE_KIND_LABEL[k]}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
              <label className="block space-y-1">
                <span className="text-xs font-medium">Para que serve (a IA lê isto ao escolher o modelo)</span>
                <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: slide de conteúdo com título e dois parágrafos em caixas" className="h-9 bg-white" />
              </label>
              <FieldList
                texts={texts}
                images={images}
                selected={selected}
                onSelect={(id) => setSelected((s) => (s === id ? null : id))}
                onText={patchText}
                onImage={(key, patch) => {
                  setPreview(null);
                  setImages((list) => list.map((d) => (d.key === key ? { ...d, ...patch } : d)));
                }}
                onAddImage={addImage}
                onRemoveImage={(key) => {
                  setPreview(null);
                  setImages((list) => list.filter((d) => d.key !== key));
                }}
              />
              <button type="button" onClick={() => void generate()} disabled={generating || boxes.length === 0} className={primary}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Gerar fundo e prévia
              </button>
            </div>
          </div>

          {preview && (
            <div className="space-y-4 border-t border-black/[0.08] pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">3. Confira</h3>
                  <p className="text-xs text-muted-foreground">À esquerda o .ai, à direita o modelo com o mesmo texto. Use “Sobrepor” para ver se os textos caem no mesmo lugar.</p>
                </div>
                <label className="flex items-center gap-2 text-xs">
                  Sobrepor
                  <input type="range" min={0} max={1} step={0.05} value={overlay} onChange={(e) => setOverlay(Number(e.target.value))} className="w-32 accent-[#04202f]" />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <figure className="space-y-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={artboard.originalUrl} alt="Original" className="w-full border border-black/[0.1]" />
                  <figcaption className="text-center text-[11px] text-muted-foreground">Original (.ai)</figcaption>
                </figure>
                <figure className="space-y-1">
                  <div className="relative border border-black/[0.1]">
                    <ScaledBox artWidth={size.width} artHeight={size.height}>
                      <DynamicSlide layout={{ fundo: "", caixas: boxes }} formato={artboard.formato} fundoUrl={preview.url} valores={exemplo} indice={0} total={1} tipo={uso[0] ?? "feed"} />
                    </ScaledBox>
                    {overlay > 0 && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={artboard.originalUrl} alt="" className="pointer-events-none absolute inset-0 h-full w-full" style={{ opacity: overlay }} />
                    )}
                  </div>
                  <figcaption className="text-center text-[11px] text-muted-foreground">Modelo no Estúdio</figcaption>
                </figure>
              </div>
              {missingFonts.length > 0 && (
                <p className="text-xs text-amber-700">
                  {missingFonts.length === 1 ? "Um campo usa fonte" : `${missingFonts.length} campos usam fontes`} sem arquivo no Estúdio ({[...new Set(missingFonts.map((d) => d.fontePdf))].join(", ")}): a prévia mostra a Montserrat no lugar. Envie em Estúdio › Fontes e o modelo passa a usar a fonte certa.
                </p>
              )}
              <button type="button" onClick={() => void save()} disabled={!canSave || saving} className={primary}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar modelo em [{tag}]
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
