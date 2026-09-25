"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckSquare,
  Eye,
  EyeOff,
  ImageOff,
  Loader2,
  RefreshCw,
  ScanFace,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhotoConfirmDialog } from "@/components/collaborator-photos/photo-confirm-dialog";
import { EventPhotoLightbox } from "@/components/event-photos/event-photo-lightbox";
import {
  deleteEventAlbum,
  deleteEventPhotos,
  fetchEventAlbum,
  fetchFaceReferences,
  rejectFaceMatch,
  updateEventAlbum,
  uploadEventPhoto,
} from "@/lib/event-photos/api";
import {
  EVENT_PHOTO_UPLOAD_CONCURRENCY,
  formatAlbumDate,
  validateEventPhotoFile,
} from "@/lib/event-photos/domain";
import type { FaceReferenceSet } from "@/lib/event-photos/faces";
import { cn } from "@/lib/utils";
import type { EventPhoto, EventPhotoAlbum } from "@/lib/event-photos/types";

interface UploadState {
  total: number;
  done: number;
  failures: Array<{ name: string; message: string }>;
  /** Marcações de pessoas reconhecidas nas fotos enviadas. */
  recognized: number;
  faceCheck: "loading" | "on" | "off" | "failed";
}

type PendingConfirm =
  | { kind: "photos"; ids: string[] }
  | { kind: "album" }
  | null;

function PhotoTile({
  photo,
  index,
  selecting,
  selected,
  onOpen,
  onToggle,
}: {
  photo: EventPhoto;
  index: number;
  selecting: boolean;
  selected: boolean;
  onOpen: (index: number) => void;
  onToggle: (id: string) => void;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      onClick={() => (selecting ? onToggle(photo.id) : onOpen(index))}
      className={cn(
        "group relative aspect-[4/3] overflow-hidden rounded-md bg-[#eaf1f2] outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]",
        selected && "ring-2 ring-[#47cdd0] ring-offset-2"
      )}
      aria-label={selecting ? `${selected ? "Desmarcar" : "Selecionar"} foto ${index + 1}` : `Ampliar foto ${index + 1}`}
      aria-pressed={selecting ? selected : undefined}
    >
      {failed ? (
        <div className="grid h-full place-items-center text-[#8aa4ad]">
          <ImageOff className="h-6 w-6" aria-hidden="true" />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo.previewUrl ?? photo.publicUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className={cn(
            "h-full w-full object-cover transition-transform duration-300",
            !selecting && "group-hover:scale-[1.03]",
            selected && "scale-95"
          )}
        />
      )}
      {selecting && (
        <span
          className={cn(
            "absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full border-2 border-white shadow",
            selected ? "bg-[#347796] text-white" : "bg-black/25"
          )}
          aria-hidden="true"
        >
          {selected && <Check className="h-3.5 w-3.5" />}
        </span>
      )}
    </button>
  );
}

export function EventAlbumClient({ slug }: { slug: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [album, setAlbum] = useState<EventPhotoAlbum | null>(null);
  const [photos, setPhotos] = useState<EventPhoto[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [upload, setUpload] = useState<UploadState | null>(null);
  const [dragging, setDragging] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<PendingConfirm>(null);
  const [busy, setBusy] = useState(false);
  const [myPhotoIds, setMyPhotoIds] = useState<Set<string>>(new Set());
  const [onlyMine, setOnlyMine] = useState(false);

  const uploading = upload !== null && upload.done < upload.total;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEventAlbum(slug);
      setAlbum(data.album);
      setPhotos(data.photos);
      setMyPhotoIds(new Set(data.myPhotoIds));
      setCanManage(data.canManage);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar álbum.";
      if (message.includes("não encontrado")) setNotFound(true);
      else setError(message);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  // Evita fechar a aba no meio de um envio grande.
  useEffect(() => {
    if (!uploading) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [uploading]);

  async function handleFiles(fileList: FileList | File[] | null) {
    if (!album || !fileList || uploading) return;
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const failures: UploadState["failures"] = [];
    const valid = files.filter((file) => {
      const invalid = validateEventPhotoFile(file);
      if (invalid) failures.push({ name: file.name, message: invalid });
      return !invalid;
    });
    valid.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }));

    setUpload({
      total: files.length,
      done: failures.length,
      failures: [...failures],
      recognized: 0,
      faceCheck: "loading",
    });

    // Referências de quem aderiu ao reconhecimento; sem elas o upload segue normal.
    let people: FaceReferenceSet[] = [];
    let faceCheck: UploadState["faceCheck"] = "off";
    try {
      people = await fetchFaceReferences();
      faceCheck = people.length > 0 ? "on" : "off";
    } catch {
      faceCheck = "failed";
    }
    setUpload((prev) => prev && { ...prev, faceCheck });

    let cursor = 0;
    const worker = async () => {
      while (cursor < valid.length) {
        const file = valid[cursor++];
        try {
          const result = await uploadEventPhoto(album.id, file, people);
          setPhotos((prev) => [...prev, result.photo]);
          setUpload(
            (prev) =>
              prev && {
                ...prev,
                done: prev.done + 1,
                recognized: prev.recognized + result.recognized,
                faceCheck: result.faceCheckFailed ? "failed" : prev.faceCheck,
              }
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "Falha no envio.";
          setUpload(
            (prev) =>
              prev && {
                ...prev,
                done: prev.done + 1,
                failures: [...prev.failures, { name: file.name, message }],
              }
          );
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(EVENT_PHOTO_UPLOAD_CONCURRENCY, valid.length) }, worker)
    );
    if (fileRef.current) fileRef.current.value = "";
  }

  async function togglePublished() {
    if (!album) return;
    setBusy(true);
    setError(null);
    try {
      setAlbum(await updateEventAlbum(album.id, { isPublished: !album.isPublished }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar álbum.");
    } finally {
      setBusy(false);
    }
  }

  async function setCover(photo: EventPhoto) {
    if (!album) return;
    setBusy(true);
    try {
      setAlbum(await updateEventAlbum(album.id, { coverPhotoId: photo.id }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao definir capa.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmPending() {
    if (!pending || !album) return;
    setBusy(true);
    setError(null);
    try {
      if (pending.kind === "album") {
        await deleteEventAlbum(album.id);
        router.push("/fotos-eventos");
        return;
      }
      const deleted = new Set(await deleteEventPhotos(pending.ids));
      setPhotos((prev) => prev.filter((p) => !deleted.has(p.id)));
      setAlbum((prev) =>
        prev && {
          ...prev,
          photoCount: Math.max(0, prev.photoCount - deleted.size),
          coverPhotoId: prev.coverPhotoId && deleted.has(prev.coverPhotoId) ? null : prev.coverPhotoId,
        }
      );
      setSelected(new Set());
      setSelecting(false);
      setOpenIndex(null);
      setPending(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir.");
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const visiblePhotos = onlyMine ? photos.filter((p) => myPhotoIds.has(p.id)) : photos;

  async function handleNotMe(photo: EventPhoto) {
    setBusy(true);
    setError(null);
    try {
      await rejectFaceMatch(photo.id);
      const next = new Set(myPhotoIds);
      next.delete(photo.id);
      setMyPhotoIds(next);
      if (onlyMine) {
        setOpenIndex(null);
        if (next.size === 0) setOnlyMine(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover a marcação.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-20 animate-pulse rounded-lg bg-[#eaf1f2]" />
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="aspect-[4/3] animate-pulse rounded-md bg-[#eaf1f2]" />
          ))}
        </div>
      </div>
    );
  }

  if (notFound || !album) {
    return (
      <div className="flex flex-col items-center rounded-lg border border-dashed border-[#c9dde0] bg-white px-6 py-14 text-center">
        <p className="text-sm font-semibold text-[#102f3d]">
          {error ?? "Álbum não encontrado ou ainda não publicado."}
        </p>
        <div className="mt-4 flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/fotos-eventos">
              <ArrowLeft className="h-4 w-4" />
              Todos os álbuns
            </Link>
          </Button>
          {error && (
            <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
              <RefreshCw className="h-3.5 w-3.5" />
              Tentar novamente
            </Button>
          )}
        </div>
      </div>
    );
  }

  const date = formatAlbumDate(album.eventDate);
  const failures = upload?.failures ?? [];

  return (
    <div
      className="relative space-y-5"
      onDragOver={(event) => {
        if (!canManage || !event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setDragging(false);
      }}
      onDrop={(event) => {
        if (!canManage) return;
        event.preventDefault();
        setDragging(false);
        void handleFiles(event.dataTransfer.files);
      }}
    >
      <div className="border-b border-[#dce9eb] pb-5">
        <Link
          href="/fotos-eventos"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#347796] hover:text-[#285f7a]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Fotos de eventos
        </Link>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold leading-tight text-[#102f3d]">{album.title}</h2>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#5e7a85]">
              {date && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  {date}
                </span>
              )}
              <span className="font-mono tabular-nums">
                {photos.length} foto{photos.length === 1 ? "" : "s"}
              </span>
              {!album.isPublished && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#04202f] px-2 py-0.5 text-xs font-medium text-white">
                  <EyeOff className="h-3 w-3" aria-hidden="true" />
                  Oculto para colaboradores
                </span>
              )}
            </p>
            {album.description && (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#456370]">{album.description}</p>
            )}
          </div>

          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => void handleFiles(e.target.files)}
              />
              {selecting ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setSelected(
                        selected.size === visiblePhotos.length ? new Set() : new Set(visiblePhotos.map((p) => p.id))
                      )
                    }
                  >
                    {selected.size === visiblePhotos.length ? "Limpar" : "Selecionar todas"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={selected.size === 0 || busy}
                    onClick={() => setPending({ kind: "photos", ids: [...selected] })}
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir ({selected.size})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSelecting(false);
                      setSelected(new Set());
                    }}
                  >
                    <X className="h-4 w-4" />
                    Cancelar
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => void togglePublished()}
                  >
                    {album.isPublished ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {album.isPublished ? "Ocultar" : "Publicar"}
                  </Button>
                  {photos.length > 0 && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setSelecting(true)}>
                      <CheckSquare className="h-4 w-4" />
                      Selecionar
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={busy || uploading}
                    onClick={() => setPending({ kind: "album" })}
                  >
                    <Trash2 className="h-4 w-4" />
                    Apagar álbum
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5 bg-[#347796] text-white hover:bg-[#285f7a]"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploading ? "Enviando…" : "Subir fotos"}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {upload && (
        <div className="rounded-lg border border-[#dce9eb] bg-white px-4 py-3 text-sm shadow-[0_1px_2px_rgba(3,32,47,0.04)]" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[#153f51]">
              {uploading
                ? `Enviando ${upload.done} de ${upload.total} fotos — mantenha esta aba aberta.`
                : `Envio concluído: ${upload.total - failures.length} de ${upload.total} fotos.`}
              {upload.faceCheck === "on" && upload.recognized > 0 &&
                ` ${upload.recognized} marcação(ões) de colaboradores reconhecidos.`}
              {upload.faceCheck === "failed" &&
                " O reconhecimento facial falhou neste navegador; as fotos subiram sem marcação."}
            </span>
            {!uploading && (
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Fechar aviso" onClick={() => setUpload(null)}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eaf1f2]">
            <div
              className="h-full rounded-full bg-[#47cdd0] transition-[width] duration-300"
              style={{ width: `${upload.total ? (upload.done / upload.total) * 100 : 0}%` }}
            />
          </div>
          {failures.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-destructive">
              {failures.slice(0, 8).map((f) => (
                <li key={f.name}>
                  {f.name}: {f.message}
                </li>
              ))}
              {failures.length > 8 && <li>… e mais {failures.length - 8} arquivo(s).</li>}
            </ul>
          )}
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/35 bg-destructive/[0.08] px-4 py-2.5 text-sm text-destructive">
          {error}
        </div>
      )}

      {myPhotoIds.size > 0 && photos.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar fotos">
          <Button
            type="button"
            size="sm"
            variant={onlyMine ? "outline" : "secondary"}
            aria-pressed={!onlyMine}
            onClick={() => setOnlyMine(false)}
          >
            Todas ({photos.length})
          </Button>
          <Button
            type="button"
            size="sm"
            variant={onlyMine ? "secondary" : "outline"}
            aria-pressed={onlyMine}
            onClick={() => {
              setOnlyMine(true);
              setOpenIndex(null);
            }}
          >
            <ScanFace className="h-4 w-4" />
            Em que eu apareço ({myPhotoIds.size})
          </Button>
        </div>
      )}

      {photos.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-[#c9dde0] bg-white px-6 py-14 text-center">
          <Upload className="h-8 w-8 text-[#8aa4ad]" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-[#102f3d]">
            {canManage ? "Arraste as fotos do evento para cá" : "As fotos deste evento ainda estão chegando"}
          </p>
          <p className="mt-1 max-w-sm text-sm text-[#5e7a85]">
            {canManage
              ? "Ou use “Subir fotos”. Dá para enviar a pasta inteira de uma vez (JPG, PNG ou WEBP, até 30 MB cada)."
              : "Volte em breve para ver e baixar as fotos."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visiblePhotos.map((photo, index) => (
            <PhotoTile
              key={photo.id}
              photo={photo}
              index={index}
              selecting={selecting}
              selected={selected.has(photo.id)}
              onOpen={setOpenIndex}
              onToggle={toggleSelected}
            />
          ))}
        </div>
      )}

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-[#04202f]/70 backdrop-blur-sm">
          <div className="rounded-lg border-2 border-dashed border-[#47cdd0] bg-[#04202f]/80 px-10 py-8 text-center text-white">
            <Upload className="mx-auto h-8 w-8 text-[#47cdd0]" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold">Solte para subir em “{album.title}”</p>
          </div>
        </div>
      )}

      <EventPhotoLightbox
        photos={visiblePhotos}
        myPhotoIds={myPhotoIds}
        albumPositionOf={(photo) => photos.indexOf(photo)}
        onNotMe={(photo) => void handleNotMe(photo)}
        index={openIndex}
        albumSlug={album.slug}
        albumTitle={album.title}
        coverPhotoId={album.coverPhotoId}
        canManage={canManage}
        busy={busy}
        onIndexChange={setOpenIndex}
        onSetCover={(photo) => void setCover(photo)}
        onDelete={(photo) => {
          setOpenIndex(null);
          setPending({ kind: "photos", ids: [photo.id] });
        }}
      />

      <PhotoConfirmDialog
        open={pending !== null}
        title={pending?.kind === "album" ? "Apagar álbum" : "Excluir fotos"}
        description={
          pending?.kind === "album"
            ? `Apagar “${album.title}” e todas as ${photos.length} fotos? Esta ação não pode ser desfeita.`
            : `Excluir ${pending?.kind === "photos" ? pending.ids.length : 0} foto(s) deste álbum? Esta ação não pode ser desfeita.`
        }
        confirmLabel={pending?.kind === "album" ? "Apagar álbum" : "Excluir"}
        tone="danger"
        busy={busy}
        onConfirm={() => void confirmPending()}
        onOpenChange={(open) => {
          if (!open && !busy) setPending(null);
        }}
      />
    </div>
  );
}
