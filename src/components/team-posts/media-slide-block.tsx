"use client";

import { useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, ClipboardCopy, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InstagramMediaCard,
  InstagramMediaThumb,
} from "@/components/instagram/instagram-media-card";
import { SectionCard } from "@/components/instagram/instagram-section-card";
import type { InstagramPost } from "@/lib/instagram-posts";
import { orderSlideMedia, pickSlideMediaIds } from "@/lib/team-posts/domain";
import { cn } from "@/lib/utils";

/** Largura fixa do cartão: a imagem copiada sai igual em qualquer tela. */
const CARD_WIDTH = 280;
const SLIDE_GAP = 16;
const MAX_COLUMNS = 3;

type CopyState = "idle" | "working" | "copied" | "downloaded" | "error";

async function renderBlockPng(node: HTMLElement): Promise<Blob> {
  const { toBlob } = await import("html-to-image");
  // Fundo transparente: só os cartões vão para o slide.
  const blob = await toBlob(node, { pixelRatio: 2 });
  if (!blob) throw new Error("Não foi possível gerar a imagem.");
  return blob;
}

function canCopyImage(): boolean {
  return typeof ClipboardItem !== "undefined" && typeof navigator.clipboard?.write === "function";
}

export function MediaSlideBlock({
  posts,
  periodLabel,
  filenameBase,
}: {
  /** Posts do recorte (equipe + período). */
  posts: InstagramPost[];
  periodLabel: string;
  filenameBase: string;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => pickSlideMediaIds(posts));
  const [state, setState] = useState<CopyState>("idle");
  const [message, setMessage] = useState("");
  const blockRef = useRef<HTMLDivElement>(null);

  const chronological = useMemo(
    () => [...posts].sort((a, b) => (a.published_at ?? "").localeCompare(b.published_at ?? "")),
    [posts]
  );
  const slide = useMemo(() => orderSlideMedia(posts, selectedIds), [posts, selectedIds]);
  const columns = Math.min(Math.max(slide.length, 1), MAX_COLUMNS);
  const busy = state === "working";
  const disabled = slide.length === 0 || busy;

  const toggle = (id: string) => {
    setState("idle");
    setMessage("");
    setSelectedIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  };

  const download = async () => {
    const node = blockRef.current;
    if (!node) return;
    setState("working");
    setMessage("");
    try {
      const blob = await renderBlockPng(node);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${filenameBase}.png`;
      anchor.click();
      URL.revokeObjectURL(url);
      setState("downloaded");
      setMessage("PNG baixado. No PowerPoint, use Inserir › Imagens.");
    } catch (error) {
      console.error("[mídias] gerar PNG", error);
      setState("error");
      setMessage("Não foi possível gerar a imagem. Tente de novo em alguns segundos.");
    }
  };

  const copy = async () => {
    const node = blockRef.current;
    if (!node) return;
    if (!canCopyImage()) {
      setState("error");
      setMessage("Este navegador não deixa copiar imagens. Use Baixar PNG.");
      return;
    }
    setState("working");
    setMessage("");
    try {
      // O ClipboardItem nasce no clique, com a imagem ainda sendo gerada
      // (exigência do Safari para manter a permissão do gesto).
      await navigator.clipboard.write([new ClipboardItem({ "image/png": renderBlockPng(node) })]);
      setState("copied");
      setMessage("Imagem copiada. Cole no slide com Ctrl+V.");
    } catch (error) {
      console.error("[mídias] copiar imagem", error);
      setState("error");
      setMessage("Não foi possível copiar. Use Baixar PNG e insira a imagem no slide.");
    }
  };

  return (
    <SectionCard
      title="Mídias para o PPT"
      description={`${periodLabel} · escolha as mídias e copie: a imagem sai pronta para colar no slide.`}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="h-9 rounded-lg bg-[#347796] text-white hover:bg-[#285f7a]"
            disabled={disabled}
            onClick={copy}
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : state === "copied" ? (
              <Check className="mr-2 h-4 w-4" />
            ) : (
              <ClipboardCopy className="mr-2 h-4 w-4" />
            )}
            {state === "copied" ? "Copiado" : "Copiar imagem"}
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-9 rounded-lg" disabled={disabled} onClick={download}>
            <Download className="mr-2 h-4 w-4" />
            Baixar PNG
          </Button>
        </div>
      }
    >
      {posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma mídia da equipe no período selecionado.</p>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs text-muted-foreground">
              {slide.length} de {posts.length} selecionada{slide.length !== 1 ? "s" : ""} · toque para incluir ou tirar
            </p>
            <div className="-mx-1 overflow-x-auto px-1 pb-1">
              <div className="flex min-w-max gap-2" role="group" aria-label="Mídias do período">
                {chronological.map((post) => {
                  const selected = selectedIds.includes(post.id);
                  const date = post.published_at
                    ? format(new Date(post.published_at), "dd MMM", { locale: ptBR })
                    : "—";
                  return (
                    <button
                      key={post.id}
                      type="button"
                      aria-pressed={selected}
                      aria-label={`${date}: ${post.caption?.split("\n")[0] || "Post sem legenda"}`}
                      title={post.caption?.split("\n")[0] || "Post sem legenda"}
                      onClick={() => toggle(post.id)}
                      className={cn(
                        "relative flex w-16 flex-col items-center gap-1 rounded-md p-1 text-[11px] text-muted-foreground transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]",
                        selected ? "bg-[#47cdd0]/15 text-foreground" : "hover:bg-muted/60"
                      )}
                    >
                      <InstagramMediaThumb
                        post={post}
                        className={cn("h-14 w-14 rounded", !selected && "opacity-60")}
                      />
                      {selected && (
                        <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#347796] text-white">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                      <span className="tabular-nums">{date}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {slide.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
              Selecione ao menos uma mídia para montar a imagem.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg bg-muted/40 p-4">
              <div
                ref={blockRef}
                className="grid w-max"
                style={{ gridTemplateColumns: `repeat(${columns}, ${CARD_WIDTH}px)`, gap: SLIDE_GAP }}
              >
                {slide.map((post) => (
                  <InstagramMediaCard key={post.id} post={post} thumbClassName="aspect-[4/5]" eager />
                ))}
              </div>
            </div>
          )}

          <p role="status" aria-live="polite" className={cn("min-h-4 text-xs", state === "error" ? "text-rose-700" : "text-muted-foreground")}>
            {message}
          </p>
        </div>
      )}
    </SectionCard>
  );
}
