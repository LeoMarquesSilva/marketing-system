"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowDown, Check, CheckCircle2, Download, HardDriveDownload, ImageOff, Loader2, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EventPhotoLightbox } from "@/components/event-photos/event-photo-lightbox";
import { PublicGalleryUnavailable } from "@/components/event-photos/public-gallery-unavailable";
import { formatAlbumDate } from "@/lib/event-photos/domain";
import { formatBytes, splitIntoParts } from "@/lib/event-photos/share";
import {
  canSaveZipToDisk,
  downloadZipInMemory,
  isAbortError,
  saveZipToDisk,
  type ZipFile,
} from "@/lib/event-photos/gallery-download";
import type { EventPhoto, PublicGallery, PublicGalleryPhoto } from "@/lib/event-photos/types";
import { cn } from "@/lib/utils";

const GOLD_BUTTON =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#E1B16D] px-6 text-[14px] font-semibold text-[#0D1E2E] transition hover:bg-[#ebc287] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E1B16D] disabled:opacity-50";
const NAVY_BUTTON =
  "inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#0D1E2E] px-5 text-[13px] font-semibold text-[#FCF9F5] transition hover:bg-[#1b3247] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D1E2E] disabled:opacity-40";
const QUIET_BUTTON =
  "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[#d8cfc0] bg-white px-4 text-[13px] font-semibold text-[#0D1E2E] transition hover:border-[#9C7434] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9C7434]";
const EYEBROW = "text-[11px] font-semibold uppercase tracking-[0.28em]";

type Quality = "original" | "web";

/** O que vai para o ZIP em cada qualidade (a prévia web é a mesma da grade). */
function zipFilesFor(photos: PublicGalleryPhoto[], quality: Quality): ZipFile[] {
  return photos.map((photo) => {
    const url = quality === "original" ? photo.originalUrl : photo.previewUrl;
    const ext = url.split("?")[0].split(".").pop()?.toLowerCase() || "jpg";
    const base = photo.downloadName.replace(/\.[^.]+$/, "");
    return {
      url,
      name: `${base}.${ext}`,
      size: quality === "original" ? photo.sizeBytes : null,
    };
  });
}

/** O lightbox do álbum interno trabalha com EventPhoto; aqui só o que o convidado precisa. */
function asEventPhoto(photo: PublicGalleryPhoto): EventPhoto {
  return {
    id: photo.id,
    albumId: "",
    storagePath: "",
    publicUrl: photo.originalUrl,
    previewUrl: photo.previewUrl,
    originalFilename: photo.downloadName,
    width: photo.width,
    height: photo.height,
    sizeBytes: photo.sizeBytes,
    createdAt: "",
  };
}

function useRecordOpen(token: string) {
  useEffect(() => {
    // ?previa=1 = alguém do escritório conferindo; não conta como abertura do convidado.
    if (new URLSearchParams(window.location.search).get("previa") === "1") return;
    const key = `galeria-aberta:${token}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // Sem sessionStorage (aba anônima restrita): conta mesmo assim.
    }
    void fetch(`/api/galeria/${encodeURIComponent(token)}`, { method: "POST", keepalive: true }).catch(() => undefined);
  }, [token]);
}

function GalleryTile({
  photo,
  index,
  selecting,
  selected,
  onOpen,
  onToggle,
}: {
  photo: PublicGalleryPhoto;
  index: number;
  selecting: boolean;
  selected: boolean;
  onOpen: () => void;
  onToggle: () => void;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      onClick={selecting ? onToggle : onOpen}
      aria-pressed={selecting ? selected : undefined}
      aria-label={selecting ? `${selected ? "Desmarcar" : "Marcar"} foto ${index + 1}` : `Ampliar foto ${index + 1}`}
      className={cn(
        "group relative aspect-[3/4] overflow-hidden rounded-[6px] bg-[#ebe4d8] outline-none focus-visible:ring-2 focus-visible:ring-[#9C7434] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FCF9F5]",
        selected && "ring-[3px] ring-[#E1B16D] ring-offset-2 ring-offset-[#FCF9F5]"
      )}
    >
      {failed ? (
        <span className="grid h-full place-items-center text-[#9C7434]">
          <ImageOff className="h-6 w-6" aria-hidden />
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo.previewUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className={cn(
            "h-full w-full object-cover transition duration-500 ease-out",
            !selecting && "group-hover:scale-[1.03]",
            selected && "scale-[0.97] opacity-85"
          )}
        />
      )}
      {selecting && (
        <span
          className={cn(
            "absolute left-2 top-2 grid size-7 place-items-center rounded-full border-2 shadow-sm transition",
            selected ? "border-[#E1B16D] bg-[#E1B16D] text-[#0D1E2E]" : "border-white/90 bg-black/25 text-transparent"
          )}
          aria-hidden
        >
          <Check className="h-4 w-4" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

interface DownloadJob {
  title: string;
  photos: PublicGalleryPhoto[];
  /** Nome base do ZIP (sem extensão). */
  baseName: string;
}

interface Progress {
  done: number;
  total: number;
  /** Chrome/Edge: esperando a pessoa escolher a pasta. */
  picking: boolean;
}

function DownloadDialog({ job, onClose }: { job: DownloadJob | null; onClose: () => void }) {
  return (
    <Dialog open={job !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[90dvh] gap-0 overflow-hidden rounded-[22px] border-[#e6dccb] bg-[#FCF9F5] p-0 font-[family-name:var(--font-galeria-sans)] text-[#0D1E2E] sm:max-w-[520px]"
        closeButtonLabel="Fechar"
      >
        {/* Um painel novo a cada pedido; fechar o modal desmonta e cancela o que estiver baixando. */}
        {job && <DownloadPanel job={job} />}
      </DialogContent>
    </Dialog>
  );
}

function DownloadPanel({ job }: { job: DownloadJob }) {
  // Celular: a versão leve costuma ser o que a pessoa quer.
  const [quality, setQuality] = useState<Quality>(() =>
    window.matchMedia("(pointer: coarse)").matches ? "web" : "original"
  );
  const [toDisk] = useState(() => canSaveZipToDisk());
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [doneParts, setDoneParts] = useState<Set<number>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const files = useMemo(() => zipFilesFor(job.photos, quality), [job, quality]);
  const originalBytes = useMemo(() => job.photos.reduce((sum, p) => sum + (p.sizeBytes ?? 0), 0), [job]);
  const parts = useMemo(
    () => (quality === "original" && !toDisk ? splitIntoParts(files) : [files]),
    [files, quality, toDisk]
  );
  const multipart = parts.length > 1;

  const run = useCallback(
    async (chunk: ZipFile[], name: string, partIndex: number) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setError(null);
      setFinished(false);
      const disk = quality === "original" && toDisk;
      setProgress({ done: 0, total: chunk.length, picking: disk });
      const onFile = (done: number) => setProgress({ done, total: chunk.length, picking: false });
      try {
        if (disk) {
          await saveZipToDisk(chunk, name, controller.signal, onFile, () =>
            setProgress({ done: 0, total: chunk.length, picking: false })
          );
        } else {
          await downloadZipInMemory(chunk, name, controller.signal, onFile);
        }
        setDoneParts((prev) => new Set(prev).add(partIndex));
        if (!multipart) setFinished(true);
      } catch (err) {
        if (!isAbortError(err)) {
          setError(err instanceof Error ? err.message : "Não foi possível baixar as fotos. Tente novamente.");
        }
      } finally {
        abortRef.current = null;
        setProgress(null);
      }
    },
    [multipart, quality, toDisk]
  );

  const zipName = (partIndex: number) => {
    const suffix = quality === "web" ? "-web" : "";
    const part = multipart ? `-parte-${partIndex + 1}` : "";
    return `${job.baseName}${suffix}${part}.zip`;
  };

  const cancel = () => abortRef.current?.abort();
  const busy = progress !== null;

  return (
    <>
      <DialogHeader className="px-6 pb-4 pt-6 text-left">
        <p className={cn(EYEBROW, "text-[#9C7434]")}>Baixar fotos</p>
        <DialogTitle className="text-xl font-semibold text-[#0D1E2E]">{job.title}</DialogTitle>
        <DialogDescription className="text-[14px] text-[#4a5560]">
          {job.photos.length} foto{job.photos.length === 1 ? "" : "s"} em um arquivo ZIP.
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 overflow-y-auto px-6 pb-6">
        <fieldset disabled={busy} className="grid gap-2.5">
          <legend className="sr-only">Qualidade</legend>
          {(
            [
              {
                value: "original" as const,
                title: "Alta resolução",
                text: "Arquivos originais, para imprimir ou editar.",
                meta: originalBytes > 0 ? formatBytes(originalBytes) : null,
              },
              {
                value: "web" as const,
                title: "Tamanho web",
                text: "Versão leve, boa para celular e redes sociais.",
                meta: "Mais rápido",
              },
            ]
          ).map((option) => {
            const active = quality === option.value;
            return (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-2xl border bg-white px-4 py-3.5 transition",
                  active ? "border-[#9C7434] shadow-[0_0_0_1px_#9C7434]" : "border-[#e6dccb] hover:border-[#cdb68d]"
                )}
              >
                <input
                  type="radio"
                  name="galeria-qualidade"
                  value={option.value}
                  checked={active}
                  onChange={() => {
                    setQuality(option.value);
                    setDoneParts(new Set());
                    setFinished(false);
                  }}
                  className="mt-1 size-4 accent-[#9C7434]"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-[15px] font-semibold">{option.title}</span>
                    {option.meta && <span className="shrink-0 text-[12px] font-medium text-[#6b7480]">{option.meta}</span>}
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-[#5c6168]">{option.text}</span>
                </span>
              </label>
            );
          })}
        </fieldset>

        {quality === "original" && toDisk && !busy && !finished && (
          <p className="mt-4 flex gap-2 text-[13px] leading-relaxed text-[#4a5560]">
            <HardDriveDownload className="mt-0.5 h-4 w-4 shrink-0 text-[#9C7434]" aria-hidden />
            Você escolhe a pasta e o arquivo é salvo direto nela, sem pesar no navegador.
          </p>
        )}

        {multipart && !busy && (
          <div className="mt-4">
            <p className="text-[13px] leading-relaxed text-[#4a5560]">
              Neste navegador o arquivo sai em {parts.length} partes de até 450 MB. Baixe uma de cada vez.
            </p>
            <ul className="mt-3 grid gap-2">
              {parts.map((part, index) => {
                const first = files.indexOf(part[0]) + 1;
                const last = first + part.length - 1;
                const bytes = part.reduce((sum, f) => sum + (f.size ?? 0), 0);
                const done = doneParts.has(index);
                return (
                  <li key={index}>
                    <button
                      type="button"
                      onClick={() => void run(part, zipName(index), index)}
                      className="flex w-full items-center gap-3 rounded-xl border border-[#e6dccb] bg-white px-4 py-2.5 text-left text-[14px] transition hover:border-[#9C7434]"
                    >
                      {done ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-[#2f7a55]" aria-label="Baixada" />
                      ) : (
                        <Download className="h-4 w-4 shrink-0 text-[#9C7434]" aria-hidden />
                      )}
                      <span className="flex-1 font-semibold">Parte {index + 1}</span>
                      <span className="text-[12px] text-[#6b7480]">
                        fotos {first} a {last} · {formatBytes(bytes)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {busy && progress && (
          <div className="mt-5" role="status" aria-live="polite">
            <div className="flex items-center justify-between gap-3 text-[13px]">
              <span className="inline-flex items-center gap-2 font-medium">
                <Loader2 className="h-4 w-4 animate-spin text-[#9C7434]" aria-hidden />
                {progress.picking
                  ? "Escolha onde salvar o arquivo…"
                  : `Baixando ${Math.min(progress.done + 1, progress.total)} de ${progress.total}`}
              </span>
              <button type="button" onClick={cancel} className="text-[13px] font-semibold text-[#9C7434] hover:underline">
                Cancelar
              </button>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#ebe4d8]">
              <div
                className="h-full rounded-full bg-[#E1B16D] transition-[width] duration-300"
                style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="mt-2 text-[12px] text-[#6b7480]">Mantenha esta página aberta até terminar.</p>
          </div>
        )}

        {finished && !busy && (
          <p className="mt-5 flex items-center gap-2 rounded-2xl bg-[#eaf3ec] px-4 py-3 text-[14px] font-medium text-[#24573d]" role="status">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            Pronto! As fotos foram salvas.
          </p>
        )}

        {error && (
          <p className="mt-5 rounded-2xl bg-[#fbeaea] px-4 py-3 text-[13px] text-[#8a2a2a]" role="alert">
            {error}
          </p>
        )}

        {!multipart && !busy && (
          <div className="mt-6 flex justify-end">
            <button type="button" className={GOLD_BUTTON} onClick={() => void run(files, zipName(0), 0)}>
              <Download className="h-4 w-4" aria-hidden />
              {finished ? "Baixar de novo" : "Baixar ZIP"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export function PublicGalleryClient({ gallery }: { gallery: PublicGallery }) {
  useRecordOpen(gallery.token);
  const { album, photos } = gallery;
  // A página fica em cache por alguns minutos: o prazo também é conferido no navegador
  // (no servidor vale "não vencido", para a hidratação bater).
  const expired = useSyncExternalStore(
    subscribeNothing,
    () => Boolean(gallery.expiresAt && Date.parse(gallery.expiresAt) <= Date.now()),
    () => false
  );
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [job, setJob] = useState<DownloadJob | null>(null);
  const gridRef = useRef<HTMLElement>(null);

  const lightboxPhotos = useMemo(() => photos.map(asEventPhoto), [photos]);
  const date = formatAlbumDate(album.eventDate);
  const subtitle = [date, album.location].filter(Boolean).join(" · ");
  const selectedPhotos = photos.filter((p) => selected.has(p.id));

  if (expired) return <PublicGalleryUnavailable />;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const downloadAll = () => setJob({ title: "Todas as fotos", photos, baseName: album.slug });
  const downloadSelected = () =>
    setJob({
      title: `${selectedPhotos.length} foto${selectedPhotos.length === 1 ? "" : "s"} escolhida${selectedPhotos.length === 1 ? "" : "s"}`,
      photos: selectedPhotos,
      baseName: `${album.slug}-selecao`,
    });

  return (
    <div className="min-h-dvh bg-[#FCF9F5] font-[family-name:var(--font-galeria-sans)] text-[#0D1E2E]">
      <header className="relative isolate flex min-h-[78svh] flex-col overflow-hidden bg-[#0D1E2E] text-[#FCF9F5] sm:min-h-[min(86svh,820px)]">
        {gallery.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={gallery.cover.url}
            alt=""
            fetchPriority="high"
            className="absolute inset-0 -z-20 h-full w-full object-cover"
          />
        )}
        <div
          className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(13,30,46,0.55)_0%,rgba(13,30,46,0.15)_32%,rgba(13,30,46,0.55)_62%,rgba(13,30,46,0.94)_100%)]"
          aria-hidden
        />

        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-4 px-5 pt-5 sm:px-8 sm:pt-7">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/galeria/logo-bp-claro.png" alt="Bismarchi | Pires" width={955} height={230} className="h-auto w-[150px] sm:w-[190px]" />
          <span className={cn(EYEBROW, "hidden text-[#E1B16D] sm:inline")}>Fotos do evento</span>
        </div>

        <div className="mx-auto mt-auto w-full max-w-[1400px] px-5 pb-10 sm:px-8 sm:pb-14">
          <div className="mb-6 flex w-fit max-w-full items-center gap-3 rounded-[20px] border border-white/15 bg-[#0D1E2E]/55 py-2.5 pl-2.5 pr-5 backdrop-blur-md">
            {gallery.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={gallery.logoUrl}
                alt=""
                width={48}
                height={48}
                className="size-12 shrink-0 rounded-[14px] bg-white object-contain p-1"
              />
            )}
            <div className={cn("min-w-0", !gallery.logoUrl && "pl-2.5")}>
              <p className={cn(EYEBROW, "text-[10px] text-[#E1B16D]")}>Compartilhado com</p>
              <p className="mt-0.5 truncate text-[16px] font-semibold leading-tight">{gallery.label}</p>
            </div>
          </div>

          {subtitle && <p className={cn(EYEBROW, "text-[#E1B16D]")}>{subtitle}</p>}
          <h1 className="mt-3 max-w-4xl font-[family-name:var(--font-galeria-display)] text-[clamp(3rem,9vw,7rem)] leading-[0.92] tracking-[0.01em]">
            {album.title}
          </h1>
          {album.description && (
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-white/85 sm:text-base">{album.description}</p>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {gallery.allowDownload && photos.length > 0 && (
              <button type="button" className={GOLD_BUTTON} onClick={downloadAll}>
                <Download className="h-4 w-4" aria-hidden />
                Baixar todas
              </button>
            )}
            <button
              type="button"
              onClick={() => gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-white/35 px-6 text-[14px] font-semibold text-white transition hover:bg-white/10"
            >
              Ver as {photos.length} fotos
              <ArrowDown className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <section ref={gridRef} className="scroll-mt-0" aria-label="Fotos">
        <div className="sticky top-0 z-30 border-b border-[#e6dccb] bg-[#FCF9F5]/92 backdrop-blur-md">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
            <p className="text-[14px] text-[#4a5560]">
              {selecting ? (
                <>
                  <strong className="font-semibold text-[#0D1E2E]">{selected.size}</strong> de {photos.length} escolhidas
                </>
              ) : (
                <>
                  <strong className="font-semibold text-[#0D1E2E]">{photos.length}</strong> fotos
                </>
              )}
            </p>
            {gallery.allowDownload && photos.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {selecting ? (
                  <>
                    <button
                      type="button"
                      className={QUIET_BUTTON}
                      onClick={() =>
                        setSelected(selected.size === photos.length ? new Set() : new Set(photos.map((p) => p.id)))
                      }
                    >
                      {selected.size === photos.length ? "Limpar" : "Marcar todas"}
                    </button>
                    <button type="button" className={NAVY_BUTTON} disabled={selected.size === 0} onClick={downloadSelected}>
                      <Download className="h-4 w-4" aria-hidden />
                      Baixar ({selected.size})
                    </button>
                    <button
                      type="button"
                      className="inline-flex size-10 items-center justify-center rounded-full text-[#4a5560] transition hover:bg-[#ebe4d8]"
                      aria-label="Sair da seleção"
                      onClick={() => {
                        setSelecting(false);
                        setSelected(new Set());
                      }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className={QUIET_BUTTON} onClick={() => setSelecting(true)}>
                      Escolher fotos
                    </button>
                    <button type="button" className={NAVY_BUTTON} onClick={downloadAll}>
                      <Download className="h-4 w-4" aria-hidden />
                      Baixar todas
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-1.5 px-1.5 py-1.5 sm:grid-cols-3 sm:gap-2.5 sm:px-8 sm:py-8 lg:grid-cols-4 xl:grid-cols-5">
          {photos.map((photo, index) => (
            <GalleryTile
              key={photo.id}
              photo={photo}
              index={index}
              selecting={selecting}
              selected={selected.has(photo.id)}
              onOpen={() => setOpenIndex(index)}
              onToggle={() => toggle(photo.id)}
            />
          ))}
        </div>
      </section>

      <footer className="bg-[#0D1E2E] px-6 py-12 text-center text-[#FCF9F5]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/galeria/logo-bp-claro.png" alt="Bismarchi | Pires" width={955} height={230} className="mx-auto h-auto w-[170px]" />
        <p className="mt-5 text-[13px] text-white/70">Bismarchi | Pires Sociedade de Advogados</p>
        {gallery.expiresAt && (
          <p className="mt-1 text-[12px] text-white/50">
            Link disponível até {new Date(gallery.expiresAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}.
          </p>
        )}
      </footer>

      <EventPhotoLightbox
        photos={lightboxPhotos}
        index={openIndex}
        albumSlug={album.slug}
        albumTitle={album.title}
        coverPhotoId={null}
        canManage={false}
        busy={false}
        myPhotoIds={EMPTY_SET}
        maybePhotoIds={EMPTY_SET}
        albumPositionOf={(photo) => lightboxPhotos.indexOf(photo)}
        onIndexChange={setOpenIndex}
        onNotMe={NOOP}
        onConfirmMe={NOOP}
        onSetCover={NOOP}
        onDelete={NOOP}
        allowDownload={gallery.allowDownload}
        downloadClassName="bg-[#E1B16D] text-[#0D1E2E] hover:bg-[#ebc287]"
      />

      <DownloadDialog job={job} onClose={() => setJob(null)} />
    </div>
  );
}

const EMPTY_SET: Set<string> = new Set();
const NOOP = () => undefined;
const subscribeNothing = () => NOOP;
