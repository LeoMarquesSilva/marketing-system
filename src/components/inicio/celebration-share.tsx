"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Copy, Download, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmployeeAvatar } from "@/components/ferias/employee-avatar";
import { CARD_HEIGHT, CARD_WIDTH, canvasToBlob, downloadBlob, drawMessagesCard } from "@/lib/inicio/celebration-card";
import { CELEBRATION_PRAISES, type CelebrationDetail } from "@/lib/inicio/celebrations";
import type { HomeCelebration } from "@/lib/inicio/types";
import { awardSealSrc } from "@/lib/rh/bp-awards/types";
import { cn } from "@/lib/utils";

/** Quantas mensagens cabem no cartão. */
const MAX_MESSAGES = 4;

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

function slug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function defaultCaption(item: HomeCelebration): string {
  const opening =
    item.kind === "aniversario"
      ? "Mais um ano de vida, e comemorado com o carinho do time da Bismarchi | Pires."
      : `${item.years ?? 0} ${plural(item.years ?? 0, "ano", "anos")} de Bismarchi | Pires, e o carinho do time para comemorar.`;
  return `${opening}\n\nAgradeço a cada pessoa pelas mensagens.\n\n@bismarchipires #SomosÚnicos`;
}

/**
 * Montador do post: o aniversariante escolhe as mensagens, ajusta a legenda e
 * leva para as redes a arte + o cartão "mensagens do time".
 */
export function CelebrationShare({
  item,
  detail,
  onBack,
}: {
  item: HomeCelebration;
  detail: CelebrationDetail;
  onBack: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const firstName = item.name.split(" ")[0];
  const [selected, setSelected] = useState<string[]>(() => detail.comments.slice(0, 3).map((comment) => comment.id));
  const [caption, setCaption] = useState(() => defaultCaption(item));
  const [preview, setPreview] = useState<"card" | "art">(detail.comments.length > 0 ? "card" : item.artUrl ? "art" : "card");
  const [drawing, setDrawing] = useState(false);
  const [busy, setBusy] = useState<"share" | "download" | null>(null);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const messages = useMemo(
    () =>
      detail.comments
        .filter((comment) => selected.includes(comment.id))
        .map((comment) => ({
          // Só o primeiro nome vai para fora do escritório.
          name: comment.author.name.split(" ")[0],
          department: comment.author.department,
          body: comment.body,
          avatarUrl: comment.author.avatarUrl,
        })),
    [detail.comments, selected]
  );
  const values = useMemo(
    () =>
      detail.praises
        .filter((praise) => praise.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .map((praise) => ({
          label: CELEBRATION_PRAISES.find((entry) => entry.key === praise.key)?.label ?? "",
          sealSrc: awardSealSrc(praise.key),
        })),
    [detail.praises]
  );
  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
        new Date(`${item.year}-${String(item.month).padStart(2, "0")}-${String(item.day).padStart(2, "0")}T12:00:00Z`)
      ),
    [item.year, item.month, item.day]
  );
  const occasion = item.kind === "aniversario" ? "aniversário" : `${item.years ?? 0} ${plural(item.years ?? 0, "ano", "anos")} de casa`;

  useEffect(() => {
    const target = canvas.current;
    if (!target) return;
    let cancelled = false;
    setDrawing(true);
    drawMessagesCard(target, { firstName, occasion, dateLabel, messages, values }).finally(() => {
      if (!cancelled) setDrawing(false);
    });
    return () => {
      cancelled = true;
    };
  }, [firstName, occasion, dateLabel, messages, values]);

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : current.length >= MAX_MESSAGES ? current : [...current, id]
    );

  /** Arquivos do post: a arte (quando existe) e o cartão de mensagens. */
  const buildFiles = async (): Promise<File[]> => {
    const files: File[] = [];
    const base = `aniversario-${slug(firstName)}`;
    if (item.artUrl) {
      const response = await fetch(item.artUrl);
      if (response.ok) {
        const blob = await response.blob();
        const extension = blob.type === "image/jpeg" ? "jpg" : blob.type === "image/webp" ? "webp" : "png";
        files.push(new File([blob], `${base}-arte.${extension}`, { type: blob.type || "image/png" }));
      }
    }
    if (canvas.current && messages.length > 0) {
      const blob = await canvasToBlob(canvas.current);
      if (blob) files.push(new File([blob], `${base}-mensagens.png`, { type: "image/png" }));
    }
    return files;
  };

  const download = async () => {
    setBusy("download");
    setNotice(null);
    try {
      const files = await buildFiles();
      if (files.length === 0) throw new Error("Não foi possível gerar as imagens.");
      files.forEach((file) => downloadBlob(file, file.name));
      setNotice(`${files.length} ${plural(files.length, "imagem baixada", "imagens baixadas")}. Agora é só anexar no post.`);
    } catch (failure) {
      setNotice(failure instanceof Error ? failure.message : "Não foi possível gerar as imagens.");
    } finally {
      setBusy(null);
    }
  };

  const share = async () => {
    setBusy("share");
    setNotice(null);
    try {
      const files = await buildFiles();
      if (files.length > 0 && typeof navigator.canShare === "function" && navigator.canShare({ files })) {
        await navigator.share({ files, text: caption });
      } else {
        // Computador: o navegador não entrega imagem para as redes. Baixa as imagens e copia a legenda.
        files.forEach((file) => downloadBlob(file, file.name));
        await navigator.clipboard.writeText(caption).catch(() => undefined);
        setNotice("Imagens baixadas e legenda copiada. Abra a rede, cole a legenda e anexe as imagens.");
      }
    } catch (failure) {
      // A pessoa fechou a folha de compartilhamento: não é erro.
      if (!(failure instanceof DOMException && failure.name === "AbortError")) {
        setNotice("Não foi possível compartilhar por aqui. Use Baixar imagens.");
      }
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setNotice("Não foi possível copiar. Selecione o texto e copie.");
    }
  };

  const tab = (key: "card" | "art", label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={preview === key}
      onClick={() => setPreview(key)}
      className={cn(
        "min-h-9 rounded-md px-3 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#47cdd0]",
        preview === key ? "bg-[#12385a] text-white" : "text-[#22404d] hover:bg-[#e6eef2]"
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto bg-[#f7fafb] p-5 md:grid-cols-[5fr_6fr] md:overflow-hidden">
      {/* Prévia das imagens do post */}
      <div className="flex flex-col gap-3 md:min-h-0">
        {item.artUrl && (
          <div role="tablist" aria-label="Imagens do post" className="flex gap-1 self-start rounded-lg border border-[#d5e2e6] bg-white p-1">
            {tab("card", "Mensagens do time")}
            {tab("art", "Arte")}
          </div>
        )}
        <div className="relative flex min-h-[280px] flex-1 items-center justify-center overflow-hidden rounded-lg bg-[#0D1E2E] md:min-h-0">
          <canvas
            ref={canvas}
            width={CARD_WIDTH}
            height={CARD_HEIGHT}
            aria-label={`Cartão com as mensagens do time para ${firstName}`}
            className={cn("max-h-[60dvh] w-auto max-w-full md:max-h-full", preview !== "card" && "hidden")}
          />
          {preview === "art" && item.artUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.artUrl} alt={`Arte de ${item.name}`} className="max-h-[60dvh] w-auto max-w-full object-contain md:max-h-full" />
          )}
          {drawing && preview === "card" && (
            <span className="absolute right-3 top-3 rounded-full bg-black/40 p-1.5 text-white">
              <Loader2 className="size-4 animate-spin" aria-label="Montando o cartão" />
            </span>
          )}
        </div>
      </div>

      {/* Escolhas e ações */}
      <div className="flex flex-col gap-4 md:min-h-0 md:overflow-y-auto md:pr-1">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="size-4" aria-hidden />
            Voltar
          </Button>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[#0D1E2E]">Montar o post</h3>
            <p className="text-xs text-[#5a717b]">
              {item.artUrl ? "Duas imagens: a arte e o cartão com as mensagens." : "Uma imagem: o cartão com as mensagens."}
            </p>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-[#22404d]">
            Mensagens no cartão{" "}
            <span className="font-normal text-[#5a717b]">
              ({selected.length} de {MAX_MESSAGES})
            </span>
          </p>
          {detail.comments.length === 0 ? (
            <p className="mt-2 rounded-lg border border-dashed border-[#d5e2e6] bg-white px-4 py-4 text-sm text-muted-foreground">
              Ainda não há mensagens. Quando o time escrever, elas aparecem aqui para você escolher.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {detail.comments.map((comment) => {
                const checked = selected.includes(comment.id);
                return (
                  <li key={comment.id}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      disabled={!checked && selected.length >= MAX_MESSAGES}
                      onClick={() => toggle(comment.id)}
                      className={cn(
                        "flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#47cdd0] disabled:opacity-50",
                        checked ? "border-[#347796] bg-[#eef7f9]" : "border-[#dce9eb] bg-white hover:bg-[#f4fafb]"
                      )}
                    >
                      <EmployeeAvatar name={comment.author.name} avatarUrl={comment.author.avatarUrl} className="h-8 w-8" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[#0d2a38]">{comment.author.name}</span>
                        <span className="line-clamp-2 text-xs text-[#3b5560]">{comment.body}</span>
                      </span>
                      <span
                        className={cn(
                          "mt-1 flex size-5 shrink-0 items-center justify-center rounded border",
                          checked ? "border-[#347796] bg-[#347796] text-white" : "border-[#b9cdd3] bg-white"
                        )}
                        aria-hidden
                      >
                        {checked && <Check className="size-3.5" />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-2 text-xs text-[#5a717b]">
            O cartão leva o primeiro nome, a área e a foto de quem escreveu. Escolha só mensagens que a pessoa ficaria à vontade de ver publicadas.
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="legenda-do-post" className="text-sm font-medium text-[#22404d]">
              Legenda
            </label>
            <Button variant="ghost" size="sm" onClick={copy}>
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              {copied ? "Copiada" : "Copiar"}
            </Button>
          </div>
          <textarea
            id="legenda-do-post"
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            rows={6}
            className="mt-1 w-full resize-none rounded-lg border border-[#cfdde2] bg-white px-3 py-2 text-sm leading-relaxed outline-none focus:border-[#47cdd0] focus:ring-2 focus:ring-[#47cdd0]/30"
          />
        </div>

        {notice && (
          <p role="status" className="rounded-md bg-[#eef7f9] px-3 py-2 text-sm text-[#22404d]">
            {notice}
          </p>
        )}

        <div className="mt-auto flex flex-wrap gap-2">
          <Button className="bg-[#12385a] hover:bg-[#0D1E2E]" disabled={busy !== null} onClick={share}>
            {busy === "share" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Share2 className="size-4" aria-hidden />}
            Compartilhar
          </Button>
          <Button variant="outline" disabled={busy !== null} onClick={download}>
            {busy === "download" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
            Baixar imagens
          </Button>
          <Button variant="outline" asChild>
            <a href={`https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(caption)}`} target="_blank" rel="noreferrer">
              Abrir o LinkedIn
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="https://www.instagram.com/" target="_blank" rel="noreferrer">
              Abrir o Instagram
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
